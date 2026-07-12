import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildProductTrialPacket } from "./build-product-trial-packet";
import { verifyProductTrialPacket } from "./verify-product-trial-packet";

const artifactsDir = path.join(process.cwd(), "artifacts", "productization");
const packetDir = path.join(artifactsDir, "public-beta-packet");
const docsDir = path.join(packetDir, "docs");
const evidenceDir = path.join(packetDir, "evidence");

type ReadinessCheck = {
  name: string;
  pass: boolean;
  requiredForBeta: boolean;
  evidence: string;
  nextAction?: string;
};

type CopySource = {
  source: string;
  destination: string;
  required: boolean;
};

type GeneratedPacketFile = {
  source: string;
  destination: string;
  role: string;
  required: boolean;
  bytes: number;
};

const evidenceFiles: CopySource[] = [
  {
    source: "artifacts/productization/product-verification-receipt.json",
    destination: "evidence/product-verification-receipt.json",
    required: true
  },
  {
    source: "artifacts/productization/product-ui-api-smoke.json",
    destination: "evidence/product-ui-api-smoke.json",
    required: true
  },
  {
    source: "artifacts/productization/product-runtime-verification.json",
    destination: "evidence/product-runtime-verification.json",
    required: true
  },
  {
    source: "artifacts/productization/product-runtime-doctor.json",
    destination: "evidence/product-runtime-doctor.json",
    required: true
  },
  {
    source: "artifacts/productization/product-release-readiness.json",
    destination: "evidence/product-release-readiness.json",
    required: true
  },
  {
    source: "artifacts/productization/productization-evidence-freshness.json",
    destination: "evidence/productization-evidence-freshness.json",
    required: true
  },
  {
    source: "artifacts/productization/product-status-summary.json",
    destination: "evidence/product-status-summary.json",
    required: true
  },
  {
    source: "artifacts/productization/product-status-summary-verification.json",
    destination: "evidence/product-status-summary-verification.json",
    required: true
  },
  {
    source: "artifacts/productization/product-status-summary.md",
    destination: "docs/PRODUCT_STATUS_SUMMARY.md",
    required: true
  },
  {
    source: "artifacts/productization/productization-launch-checklist.json",
    destination: "evidence/productization-launch-checklist.json",
    required: true
  },
  {
    source: "artifacts/productization/productization-launch-checklist-verification.json",
    destination: "evidence/productization-launch-checklist-verification.json",
    required: true
  },
  {
    source: "artifacts/productization/productization-launch-checklist.md",
    destination: "docs/PRODUCTIZATION_LAUNCH_CHECKLIST.md",
    required: true
  },
  {
    source: "artifacts/productization/product-operator-brief.json",
    destination: "evidence/product-operator-brief.json",
    required: true
  },
  {
    source: "artifacts/productization/product-operator-brief-verification.json",
    destination: "evidence/product-operator-brief-verification.json",
    required: true
  },
  {
    source: "artifacts/productization/product-operator-brief.md",
    destination: "docs/PRODUCT_OPERATOR_BRIEF.md",
    required: true
  },
    {
    source: "artifacts/productization/product-takeover-decision-matrix.json",
    destination: "evidence/product-takeover-decision-matrix.json",
    required: true
  },
  {
    source: "artifacts/productization/product-takeover-decision-matrix-verification.json",
    destination: "evidence/product-takeover-decision-matrix-verification.json",
    required: true
  },
  {
    source: "artifacts/productization/product-takeover-decision-matrix.md",
    destination: "docs/PRODUCT_TAKEOVER_DECISION_MATRIX.md",
    required: true
  },
  {
    source: "artifacts/productization/product-takeover-entry-consistency.json",
    destination: "evidence/product-takeover-entry-consistency.json",
    required: true
  },
  {
    source: "artifacts/productization/product-release-blocker-board.json",
    destination: "evidence/product-release-blocker-board.json",
    required: true
  },
  {
    source: "artifacts/productization/product-release-blocker-board-verification.json",
    destination: "evidence/product-release-blocker-board-verification.json",
    required: true
  },
  {
    source: "artifacts/productization/product-release-blocker-board.md",
    destination: "docs/PRODUCT_RELEASE_BLOCKER_BOARD.md",
    required: true
  },
  {
    source: "artifacts/productization/product-release-approval.template.json",
    destination: "docs/PRODUCT_RELEASE_APPROVAL.template.json",
    required: true
  },
  {
    source: "artifacts/productization/product-release-approval-template.md",
    destination: "docs/PRODUCT_RELEASE_APPROVAL_TEMPLATE.md",
    required: true
  },
  {
    source: "artifacts/productization/product-release-approval-validation.json",
    destination: "evidence/product-release-approval-validation.json",
    required: true
  },
  {
    source: "artifacts/productization/product-release-approval-return-intake-verification.json",
    destination: "evidence/product-release-approval-return-intake-verification.json",
    required: true
  },
  {
    source: "artifacts/productization/real-model-trial-kit.json",
    destination: "evidence/real-model-trial-kit.json",
    required: true
  },
  {
    source: "artifacts/productization/real-model-adapter-contract-verification.json",
    destination: "evidence/real-model-adapter-contract-verification.json",
    required: true
  },
  {
    source: "artifacts/productization/real-model-trial-kit-verification.json",
    destination: "evidence/real-model-trial-kit-verification.json",
    required: true
  },
  {
    source: "artifacts/productization/real-model-trial-kit.md",
    destination: "docs/REAL_MODEL_TRIAL_KIT.md",
    required: true
  },
  {
    source: "artifacts/productization/real-model-trial-receipt.template.json",
    destination: "docs/REAL_MODEL_TRIAL_RECEIPT.template.json",
    required: true
  },
  {
    source: "artifacts/productization/real-model-trial-receipt-template.md",
    destination: "docs/REAL_MODEL_TRIAL_RECEIPT_TEMPLATE.md",
    required: true
  },
  {
    source: "artifacts/productization/real-model-trial-receipt-validation.json",
    destination: "evidence/real-model-trial-receipt-validation.json",
    required: true
  },
  {
    source: "artifacts/productization/real-model-trial-return-intake-verification.json",
    destination: "evidence/real-model-trial-return-intake-verification.json",
    required: true
  },
  {
    source: "artifacts/productization/product-handoff-readiness.json",
    destination: "evidence/product-handoff-readiness.json",
    required: true
  },
  {
    source: "artifacts/productization/human-acceptance-gate.json",
    destination: "evidence/human-acceptance-gate.json",
    required: true
  },
  {
    source: "artifacts/productization/human-acceptance-session-preflight.json",
    destination: "evidence/human-acceptance-session-preflight.json",
    required: true
  },
  {
    source: "artifacts/productization/human-acceptance-reviewer-kit.json",
    destination: "evidence/human-acceptance-reviewer-kit.json",
    required: true
  },
  {
    source: "artifacts/productization/human-acceptance-reviewer-kit-verification.json",
    destination: "evidence/human-acceptance-reviewer-kit-verification.json",
    required: true
  },
  {
    source: "artifacts/productization/human-acceptance-reviewer-kit.md",
    destination: "docs/HUMAN_ACCEPTANCE_REVIEWER_KIT.md",
    required: true
  },
  {
    source: "artifacts/productization/human-acceptance-reviewer-invite.json",
    destination: "evidence/human-acceptance-reviewer-invite.json",
    required: true
  },
  {
    source: "artifacts/productization/human-acceptance-reviewer-invite-verification.json",
    destination: "evidence/human-acceptance-reviewer-invite-verification.json",
    required: true
  },
  {
    source: "artifacts/productization/human-acceptance-reviewer-invite.md",
    destination: "docs/HUMAN_ACCEPTANCE_REVIEWER_INVITE.md",
    required: true
  },
  {
    source: "artifacts/productization/human-acceptance-receipt.template.json",
    destination: "docs/HUMAN_ACCEPTANCE_RECEIPT.template.json",
    required: true
  },
  {
    source: "artifacts/productization/human-acceptance-receipt-template.md",
    destination: "docs/HUMAN_ACCEPTANCE_RECEIPT_TEMPLATE.md",
    required: true
  },
  {
    source: "artifacts/productization/human-acceptance-receipt-validation.json",
    destination: "evidence/human-acceptance-receipt-validation.json",
    required: true
  },
  {
    source: "artifacts/productization/human-acceptance-return-intake-verification.json",
    destination: "evidence/human-acceptance-return-intake-verification.json",
    required: true
  },
  {
    source: "artifacts/productization/human-acceptance-return-intake.json",
    destination: "evidence/human-acceptance-return-intake.json",
    required: false
  },
  {
    source: "artifacts/productization/manual-acceptance-classification-verification.json",
    destination: "evidence/manual-acceptance-classification-verification.json",
    required: true
  },
  {
    source: "artifacts/productization/manual-acceptance-latest.json",
    destination: "evidence/manual-acceptance-latest.json",
    required: true
  },
  {
    source: "artifacts/productization/runtime-artifact-cleanup.json",
    destination: "evidence/runtime-artifact-cleanup.json",
    required: true
  },
  {
    source: "artifacts/productization/live-product-handoff.json",
    destination: "evidence/live-product-handoff.json",
    required: true
  },
  {
    source: "artifacts/productization/handoff-browser-smoke.json",
    destination: "evidence/handoff-browser-smoke.json",
    required: false
  },
  {
    source: "artifacts/productization/public-beta-browser-smoke.json",
    destination: "evidence/public-beta-browser-smoke.json",
    required: false
  },
  {
    source: "artifacts/productization/public-beta-browser-desktop.png",
    destination: "evidence/public-beta-browser-desktop.png",
    required: false
  },
  {
    source: "artifacts/productization/public-beta-browser-mobile.png",
    destination: "evidence/public-beta-browser-mobile.png",
    required: false
  },
  {
    source: "artifacts/productization/public-beta-readiness.json",
    destination: "evidence/public-beta-readiness.json",
    required: false
  },
  {
    source: "artifacts/productization/public-beta-feedback-receipt-validation.json",
    destination: "evidence/public-beta-feedback-receipt-validation.json",
    required: false
  },
  {
    source: "artifacts/productization/public-beta-feedback-api-verification.json",
    destination: "evidence/public-beta-feedback-api-verification.json",
    required: true
  },
  {
    source: "artifacts/productization/public-beta-feedback-collection.json",
    destination: "evidence/public-beta-feedback-collection.json",
    required: false
  },
  {
    source: "artifacts/productization/public-beta-feedback-collection-verification.json",
    destination: "evidence/public-beta-feedback-collection-verification.json",
    required: true
  },
  {
    source: "artifacts/productization/public-beta-follow-up-plan.json",
    destination: "evidence/public-beta-follow-up-plan.json",
    required: true
  },
  {
    source: "artifacts/productization/public-beta-follow-up-plan-verification.json",
    destination: "evidence/public-beta-follow-up-plan-verification.json",
    required: true
  },
  {
    source: "artifacts/productization/public-beta-tester-invite.json",
    destination: "evidence/public-beta-tester-invite.json",
    required: true
  },
  {
    source: "artifacts/productization/public-beta-tester-invite-verification.json",
    destination: "evidence/public-beta-tester-invite-verification.json",
    required: true
  },
  {
    source: "artifacts/productization/public-beta-session-plan.json",
    destination: "evidence/public-beta-session-plan.json",
    required: true
  },
  {
    source: "artifacts/productization/public-beta-session-plan-verification.json",
    destination: "evidence/public-beta-session-plan-verification.json",
    required: true
  },
  {
    source: "artifacts/productization/public-beta-session-receipt-validation.json",
    destination: "evidence/public-beta-session-receipt-validation.json",
    required: true
  },
  {
    source: "artifacts/productization/public-beta-tester-session-preflight.json",
    destination: "evidence/public-beta-tester-session-preflight.json",
    required: false
  },
  {
    source: "artifacts/productization/public-beta-return-intake-verification.json",
    destination: "evidence/public-beta-return-intake-verification.json",
    required: true
  },
  {
    source: "artifacts/productization/public-beta-return-intake.json",
    destination: "evidence/public-beta-return-intake.json",
    required: false
  },
  {
    source: "artifacts/productization/public-beta-preparation.json",
    destination: "evidence/public-beta-preparation.json",
    required: false
  },
  {
    source: "artifacts/productization/manual-acceptance-report.browser-smoke.json",
    destination: "evidence/manual-acceptance-report.browser-smoke.json",
    required: true
  },
  {
    source: "artifacts/productization/manual-acceptance-browser-smoke.json",
    destination: "evidence/manual-acceptance-browser-smoke.json",
    required: true
  },
  {
    source: "artifacts/productization/manual-acceptance-browser.png",
    destination: "evidence/manual-acceptance-browser.png",
    required: false
  },
  {
    source: "artifacts/productization/manual-acceptance-browser-desktop.png",
    destination: "evidence/manual-acceptance-browser-desktop.png",
    required: false
  },
  {
    source: "artifacts/productization/manual-acceptance-browser-mobile.png",
    destination: "evidence/manual-acceptance-browser-mobile.png",
    required: false
  },
  {
    source: "artifacts/productization/dashboard-product-entry.png",
    destination: "evidence/dashboard-product-entry.png",
    required: false
  },
  {
    source: "artifacts/productization/handoff-beta-feedback-desktop.png",
    destination: "evidence/handoff-beta-feedback-desktop.png",
    required: false
  },
  {
    source: "artifacts/productization/handoff-beta-feedback-mobile.png",
    destination: "evidence/handoff-beta-feedback-mobile.png",
    required: false
  },
  {
    source: "artifacts/productization/product-trial-packet/product-trial-manifest.json",
    destination: "evidence/product-trial-manifest.json",
    required: true
  },
  {
    source: "artifacts/productization/product-trial-packet/evidence/product-trial-packet-verification.json",
    destination: "evidence/product-trial-packet-verification.json",
    required: true
  }
];

const docFiles: CopySource[] = [
  { source: "README.md", destination: "docs/README.md", required: true },
  { source: "PRODUCT_HANDOFF.md", destination: "docs/PRODUCT_HANDOFF.md", required: true },
  { source: "PRODUCTIZATION_FOCUS.md", destination: "docs/PRODUCTIZATION_FOCUS.md", required: true },
  { source: "artifacts/productization/public-beta-tester-invite.md", destination: "docs/PUBLIC_BETA_TESTER_INVITE.md", required: true },
  { source: "artifacts/productization/public-beta-session-plan.md", destination: "docs/PUBLIC_BETA_SESSION_PLAN.md", required: true },
  { source: "artifacts/productization/public-beta-session-receipt.template.json", destination: "docs/PUBLIC_BETA_SESSION_RECEIPT.template.json", required: true },
  { source: "artifacts/productization/public-beta-session-receipt-template.md", destination: "docs/PUBLIC_BETA_SESSION_RECEIPT_TEMPLATE.md", required: true },
  { source: ".env.example", destination: "docs/.env.example", required: true }
];

function readJson<T>(relativePath: string): T | null {
  try {
    return JSON.parse(fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")) as T;
  } catch {
    return null;
  }
}

function timestampMs(value: string | undefined) {
  const parsed = Date.parse(value ?? "");
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function optionalRuntimeEvidenceIsFresh(file: CopySource) {
  if (file.source !== "artifacts/productization/public-beta-tester-session-preflight.json") {
    return true;
  }

  const preflight = readJson<{ generatedAt?: string }>(file.source);
  const freshness = readJson<{ generatedAt?: string }>("artifacts/productization/productization-evidence-freshness.json");
  const preflightMs = timestampMs(preflight?.generatedAt);
  const freshnessMs = timestampMs(freshness?.generatedAt);

  return Number.isFinite(preflightMs) && Number.isFinite(freshnessMs) && preflightMs >= freshnessMs;
}
function copyFile(file: CopySource) {
  const source = path.join(process.cwd(), file.source);
  const destination = path.join(packetDir, file.destination);

  if (!fs.existsSync(source)) {
    if (file.required) {
      throw new Error(`Missing public beta packet source: ${file.source}`);
    }
    return null;
  }

  if (!file.required && !optionalRuntimeEvidenceIsFresh(file)) {
    return null;
  }

  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(source, destination);

  return {
    source: file.source,
    destination: file.destination,
    required: file.required,
    bytes: fs.statSync(destination).size
  };
}

function generatedFile(destination: string, role: string): GeneratedPacketFile {
  const fullPath = path.join(packetDir, destination);

  if (!fs.existsSync(fullPath)) {
    throw new Error(`Missing generated public beta packet file: ${destination}`);
  }

  return {
    source: "scripts/build-public-beta-packet.ts",
    destination,
    role,
    required: true,
    bytes: fs.statSync(fullPath).size
  };
}

function push(checks: ReadinessCheck[], check: ReadinessCheck) {
  checks.push(check);
}

function buildReadinessChecks() {
  const productVerification = readJson<{
    status?: string;
    productionServerMode?: string;
    steps?: Array<{ label?: string; status?: string }>;
    packagingBoundary?: { accepted?: boolean; packagingGated?: boolean };
  }>("artifacts/productization/product-verification-receipt.json");
  const runtimeVerification = readJson<{ status?: string; passed?: number; total?: number }>(
    "artifacts/productization/product-runtime-verification.json"
  );
  const productUiApiSmoke = readJson<{
    responseMode?: string;
    status?: string;
    passed?: number;
    total?: number;
    releaseDecision?: string;
    accepted?: boolean;
    packagingGated?: boolean;
  }>("artifacts/productization/product-ui-api-smoke.json");
  const handoff = readJson<{ status?: string; passed?: number; total?: number }>(
    "artifacts/productization/product-handoff-readiness.json"
  );
  const liveHandoff = readJson<{
    status?: string;
    releaseDecision?: string;
    runtimeNames?: string[];
    verificationRuntimeNames?: string[];
    passed?: number;
    total?: number;
  }>("artifacts/productization/live-product-handoff.json");
  const runtimeCleanup = readJson<{
    responseMode?: string;
    status?: string;
    mode?: string;
    failedCount?: number;
    protectedRuntimeNames?: string[];
  }>("artifacts/productization/runtime-artifact-cleanup.json");
  const classification = readJson<{ status?: string; passed?: number; total?: number }>(
    "artifacts/productization/manual-acceptance-classification-verification.json"
  );
  const releaseReadiness = readJson<{
    status?: string;
    releaseDecision?: string;
    blockers?: Array<{ name?: string; evidence?: string }>;
    boundary?: { accepted?: boolean; packagingGated?: boolean; activeProvider?: string };
  }>("artifacts/productization/product-release-readiness.json");
  const productizationEvidenceFreshness = readJson<{
    responseMode?: string;
    status?: string;
    releaseDecision?: string;
    allSoftwareObjective?: string;
    accepted?: boolean;
    packagingGated?: boolean;
    canRelease?: boolean;
    passed?: number;
    total?: number;
  }>("artifacts/productization/productization-evidence-freshness.json");
  const productStatusSummary = readJson<{
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
  }>("artifacts/productization/product-status-summary.json");
  const productStatusSummaryVerification = readJson<{
    responseMode?: string;
    status?: string;
    releaseDecision?: string;
    accepted?: boolean;
    packagingGated?: boolean;
    canRelease?: boolean;
    passed?: number;
    total?: number;
  }>("artifacts/productization/product-status-summary-verification.json");
  const productizationLaunchChecklist = readJson<{
    responseMode?: string;
    status?: string;
    releaseDecision?: string;
    allSoftwareObjective?: string;
    reviewOnly?: boolean;
    accepted?: boolean;
    packagingGated?: boolean;
    canRelease?: boolean;
    canActivateRealModel?: boolean;
    lanes?: Array<{ id?: string; allowed?: boolean }>;
    blockedTransitions?: string[];
  }>("artifacts/productization/productization-launch-checklist.json");
  const productizationLaunchChecklistVerification = readJson<{
    responseMode?: string;
    status?: string;
    releaseDecision?: string;
    accepted?: boolean;
    packagingGated?: boolean;
    canRelease?: boolean;
    canActivateRealModel?: boolean;
    passed?: number;
    total?: number;
  }>("artifacts/productization/productization-launch-checklist-verification.json");
  const operatorBrief = readJson<{
    responseMode?: string;
    status?: string;
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
  }>("artifacts/productization/product-operator-brief.json");
  const operatorBriefVerification = readJson<{
    responseMode?: string;
    status?: string;
    releaseDecision?: string;
    accepted?: boolean;
    packagingGated?: boolean;
    canRelease?: boolean;
    passed?: number;
    total?: number;
  }>("artifacts/productization/product-operator-brief-verification.json");
  const releaseBlockerBoard = readJson<{
    responseMode?: string;
    status?: string;
    releaseDecision?: string;
    accepted?: boolean;
    packagingGated?: boolean;
    canRelease?: boolean;
    failedReasons?: string[];
    lanes?: unknown[];
  }>("artifacts/productization/product-release-blocker-board.json");
  const releaseBlockerBoardVerification = readJson<{
    responseMode?: string;
    status?: string;
    releaseDecision?: string;
    accepted?: boolean;
    packagingGated?: boolean;
    canRelease?: boolean;
    passed?: number;
    total?: number;
  }>("artifacts/productization/product-release-blocker-board-verification.json");
  const realModelTrialKit = readJson<{
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
    credentialRedactionChecklist?: Array<{
      id?: string;
      reviewerAction?: string;
      evidence?: string;
      stopCondition?: string;
    }>;
    evidenceToReturn?: string[];
    aiService?: { activeProvider?: string; realModelReady?: boolean };
  }>("artifacts/productization/real-model-trial-kit.json");
  const realModelAdapterContract = readJson<{
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
  }>("artifacts/productization/real-model-adapter-contract-verification.json");
  const realModelTrialKitVerification = readJson<{
    responseMode?: string;
    status?: string;
    releaseDecision?: string;
    accepted?: boolean;
    packagingGated?: boolean;
    canActivateRealModel?: boolean;
    canRelease?: boolean;
    passed?: number;
    total?: number;
  }>("artifacts/productization/real-model-trial-kit-verification.json");
  const realModelTrialKitRedactionIds = new Set(
    (realModelTrialKit?.credentialRedactionChecklist ?? []).map((item) => item.id)
  );
  const realModelTrialReceiptValidation = readJson<{
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
  }>("artifacts/productization/real-model-trial-receipt-validation.json");
  const humanAcceptance = readJson<{
    status?: string;
    latestEvidenceKind?: string;
    latestHumanReviewed?: boolean;
    latestAutomationGenerated?: boolean;
  }>("artifacts/productization/human-acceptance-gate.json");
  const humanAcceptancePreflight = readJson<{
    responseMode?: string;
    status?: string;
    canStartHumanAcceptance?: boolean;
    releaseDecision?: string;
    accepted?: boolean;
    packagingGated?: boolean;
    passed?: number;
    total?: number;
  }>("artifacts/productization/human-acceptance-session-preflight.json");
  const humanAcceptanceReviewerKit = readJson<{
    responseMode?: string;
    status?: string;
    canStartReviewerSession?: boolean;
    failedReasons?: string[];
    releaseDecision?: string;
    accepted?: boolean;
    packagingGated?: boolean;
    allSoftwareObjective?: string;
    reviewerSteps?: unknown[];
  }>("artifacts/productization/human-acceptance-reviewer-kit.json");
  const humanAcceptanceReviewerKitVerification = readJson<{
    responseMode?: string;
    status?: string;
    passed?: number;
    total?: number;
    releaseDecision?: string;
    accepted?: boolean;
    packagingGated?: boolean;
  }>("artifacts/productization/human-acceptance-reviewer-kit-verification.json");
  const humanAcceptanceReviewerInvite = readJson<{
    responseMode?: string;
    status?: string;
    canInviteHumanReviewer?: boolean;
    failedReasons?: string[];
    releaseDecision?: string;
    accepted?: boolean;
    packagingGated?: boolean;
    allSoftwareObjective?: string;
  }>("artifacts/productization/human-acceptance-reviewer-invite.json");
  const humanAcceptanceReviewerInviteVerification = readJson<{
    responseMode?: string;
    status?: string;
    passed?: number;
    total?: number;
    releaseDecision?: string;
    accepted?: boolean;
    packagingGated?: boolean;
    canRelease?: boolean;
  }>("artifacts/productization/human-acceptance-reviewer-invite-verification.json");
  const humanAcceptanceReceiptValidation = readJson<{
    responseMode?: string;
    status?: string;
    mode?: string;
    releaseDecision?: string;
    accepted?: boolean;
    packagingGated?: boolean;
    canRelease?: boolean;
    passed?: number;
    total?: number;
  }>("artifacts/productization/human-acceptance-receipt-validation.json");
  const productReleaseApprovalValidation = readJson<{
    responseMode?: string;
    status?: string;
    mode?: string;
    releaseDecision?: string;
    accepted?: boolean;
    packagingGated?: boolean;
    canRelease?: boolean;
    passed?: number;
    total?: number;
  }>("artifacts/productization/product-release-approval-validation.json");
  const feedbackCollectionVerification = readJson<{
    responseMode?: string;
    status?: string;
    passed?: number;
    total?: number;
    releaseDecision?: string;
    accepted?: boolean;
    packagingGated?: boolean;
  }>("artifacts/productization/public-beta-feedback-collection-verification.json");
  const feedbackApiVerification = readJson<{
    responseMode?: string;
    status?: string;
    passed?: number;
    total?: number;
    releaseDecision?: string;
    accepted?: boolean;
    packagingGated?: boolean;
    tempArtifactsCleaned?: boolean;
  }>("artifacts/productization/public-beta-feedback-api-verification.json");
  const followUpPlan = readJson<{
    responseMode?: string;
    status?: string;
    canInviteNextTester?: boolean;
    releaseDecision?: string;
    accepted?: boolean;
    packagingGated?: boolean;
    actions?: unknown[];
  }>("artifacts/productization/public-beta-follow-up-plan.json");
  const followUpPlanVerification = readJson<{
    responseMode?: string;
    status?: string;
    passed?: number;
    total?: number;
    releaseDecision?: string;
    accepted?: boolean;
    packagingGated?: boolean;
  }>("artifacts/productization/public-beta-follow-up-plan-verification.json");
  const testerInvite = readJson<{
    responseMode?: string;
    status?: string;
    canInvite?: boolean;
    releaseDecision?: string;
    accepted?: boolean;
    packagingGated?: boolean;
    failedReasons?: string[];
    testerChecklist?: unknown[];
    maintainerChecklist?: unknown[];
    launchPreflight?: {
      requiredImmediatelyBeforeContact?: boolean;
      command?: string;
      evidencePath?: string;
      mustBeGeneratedAfterInvite?: boolean;
      mustBeGeneratedAfterProductizationFreshness?: boolean;
      stopIf?: string;
    };
  }>("artifacts/productization/public-beta-tester-invite.json");
  const testerInviteVerification = readJson<{
    responseMode?: string;
    status?: string;
    passed?: number;
    total?: number;
    releaseDecision?: string;
    accepted?: boolean;
    packagingGated?: boolean;
  }>("artifacts/productization/public-beta-tester-invite-verification.json");
  const returnIntakeVerification = readJson<{
    responseMode?: string;
    status?: string;
    passed?: number;
    total?: number;
    releaseDecision?: string;
    accepted?: boolean;
    packagingGated?: boolean;
  }>("artifacts/productization/public-beta-return-intake-verification.json");

  const checks: ReadinessCheck[] = [];
  const productSteps = productVerification?.steps ?? [];
  const productStepsPassed = productSteps.length > 0 && productSteps.every((step) => step.status === "passed");

  push(checks, {
    name: "Product verification is green",
    pass:
      productVerification?.status === "passed" &&
      productStepsPassed &&
      productVerification.productionServerMode === "standalone_copy",
    requiredForBeta: true,
    evidence: `status=${productVerification?.status ?? "missing"}; steps=${
      productSteps.filter((step) => step.status === "passed").length
    }/${productSteps.length}; mode=${productVerification?.productionServerMode ?? "missing"}`,
    nextAction: "Run npm run verify:product."
  });

  push(checks, {
    name: "Public product runtime is verified",
    pass:
      runtimeVerification?.status === "passed" &&
      runtimeVerification.passed === runtimeVerification.total &&
      Number(runtimeVerification.total ?? 0) > 0,
    requiredForBeta: true,
    evidence: `status=${runtimeVerification?.status ?? "missing"}; checks=${runtimeVerification?.passed ?? "?"}/${
      runtimeVerification?.total ?? "?"
    }`,
    nextAction: "Run npm run verify:product-runtime."
  });

  push(checks, {
    name: "Product UI/API smoke is green",
    pass:
      productUiApiSmoke?.responseMode === "product_ui_api_smoke_receipt_json_v1" &&
      productUiApiSmoke.status === "passed" &&
      productUiApiSmoke.passed === productUiApiSmoke.total &&
      Number(productUiApiSmoke.total ?? 0) > 0 &&
      productUiApiSmoke.releaseDecision === "do_not_release" &&
      productUiApiSmoke.accepted === false &&
      productUiApiSmoke.packagingGated === true,
    requiredForBeta: true,
    evidence: `status=${productUiApiSmoke?.status ?? "missing"}; checks=${productUiApiSmoke?.passed ?? "?"}/${
      productUiApiSmoke?.total ?? "?"
    }; releaseDecision=${productUiApiSmoke?.releaseDecision ?? "missing"}`,
    nextAction: "Run npm run smoke:product -- --base-url http://127.0.0.1:3000."
  });

  push(checks, {
    name: "Handoff gate is green",
    pass: handoff?.status === "passed" && handoff.passed === handoff.total && Number(handoff.total ?? 0) >= 23,
    requiredForBeta: true,
    evidence: `status=${handoff?.status ?? "missing"}; checks=${handoff?.passed ?? "?"}/${handoff?.total ?? "?"}`,
    nextAction: "Run npm run verify:handoff."
  });

  push(checks, {
    name: "Live handoff server is green",
    pass:
      liveHandoff?.status === "passed" &&
      liveHandoff.releaseDecision === "do_not_release" &&
      liveHandoff.runtimeNames?.includes("standalone") === true &&
      liveHandoff.verificationRuntimeNames?.length === 0 &&
      liveHandoff.passed === liveHandoff.total &&
      Number(liveHandoff.total ?? 0) >= 9,
    requiredForBeta: true,
    evidence: `status=${liveHandoff?.status ?? "missing"}; runtimeNames=${
      liveHandoff?.runtimeNames?.join(",") ?? "missing"
    }; verificationRuntimeNames=${liveHandoff?.verificationRuntimeNames?.join(",") ?? "missing"}; checks=${
      liveHandoff?.passed ?? "?"
    }/${liveHandoff?.total ?? "?"}`,
    nextAction: "Run npm run verify:live-handoff -- --base-url http://127.0.0.1:3000."
  });

  push(checks, {
    name: "Runtime cleanup is applied",
    pass:
      runtimeCleanup?.responseMode === "runtime_artifact_cleanup_receipt_json_v1" &&
      runtimeCleanup.status === "passed" &&
      runtimeCleanup.mode === "apply" &&
      runtimeCleanup.failedCount === 0 &&
      runtimeCleanup.protectedRuntimeNames?.includes("standalone") === true,
    requiredForBeta: true,
    evidence: `status=${runtimeCleanup?.status ?? "missing"}; mode=${runtimeCleanup?.mode ?? "missing"}; failed=${
      runtimeCleanup?.failedCount ?? "?"
    }; protected=${runtimeCleanup?.protectedRuntimeNames?.join(",") ?? "missing"}`,
    nextAction: "Run npm run cleanup:runtime-artifacts -- --apply."
  });

  push(checks, {
    name: "Human acceptance session preflight is green",
    pass:
      humanAcceptancePreflight?.responseMode === "human_acceptance_session_preflight_json_v1" &&
      humanAcceptancePreflight.status === "passed" &&
      humanAcceptancePreflight.canStartHumanAcceptance === true &&
      humanAcceptancePreflight.releaseDecision === "do_not_release" &&
      humanAcceptancePreflight.accepted === false &&
      humanAcceptancePreflight.packagingGated === true &&
      humanAcceptancePreflight.passed === humanAcceptancePreflight.total &&
      Number(humanAcceptancePreflight.total ?? 0) >= 8,
    requiredForBeta: true,
    evidence: `status=${humanAcceptancePreflight?.status ?? "missing"}; canStart=${
      humanAcceptancePreflight?.canStartHumanAcceptance ?? "missing"
    }; checks=${humanAcceptancePreflight?.passed ?? "?"}/${humanAcceptancePreflight?.total ?? "?"}`,
    nextAction: "Run npm run preflight:human-acceptance -- --base-url http://127.0.0.1:3000."
  });

  push(checks, {
    name: "Human acceptance reviewer kit is ready",
    pass:
      humanAcceptanceReviewerKit?.responseMode === "human_acceptance_reviewer_kit_json_v1" &&
      humanAcceptanceReviewerKit.status === "ready_for_reviewer" &&
      humanAcceptanceReviewerKit.canStartReviewerSession === true &&
      (humanAcceptanceReviewerKit.failedReasons?.length ?? -1) === 0 &&
      humanAcceptanceReviewerKit.releaseDecision === "do_not_release" &&
      humanAcceptanceReviewerKit.accepted === false &&
      humanAcceptanceReviewerKit.packagingGated === true &&
      humanAcceptanceReviewerKit.allSoftwareObjective === "paused" &&
      Number(humanAcceptanceReviewerKit.reviewerSteps?.length ?? 0) >= 6,
    requiredForBeta: true,
    evidence: `status=${humanAcceptanceReviewerKit?.status ?? "missing"}; canStart=${
      humanAcceptanceReviewerKit?.canStartReviewerSession ?? "missing"
    }; steps=${humanAcceptanceReviewerKit?.reviewerSteps?.length ?? 0}`,
    nextAction: "Run npm run build:human-acceptance-reviewer-kit."
  });

  push(checks, {
    name: "Human acceptance reviewer kit verification is green",
    pass:
      humanAcceptanceReviewerKitVerification?.responseMode ===
        "human_acceptance_reviewer_kit_verification_json_v1" &&
      humanAcceptanceReviewerKitVerification.status === "passed" &&
      humanAcceptanceReviewerKitVerification.passed === humanAcceptanceReviewerKitVerification.total &&
      Number(humanAcceptanceReviewerKitVerification.total ?? 0) >= 8 &&
      humanAcceptanceReviewerKitVerification.releaseDecision === "do_not_release" &&
      humanAcceptanceReviewerKitVerification.accepted === false &&
      humanAcceptanceReviewerKitVerification.packagingGated === true,
    requiredForBeta: true,
    evidence: `status=${humanAcceptanceReviewerKitVerification?.status ?? "missing"}; checks=${
      humanAcceptanceReviewerKitVerification?.passed ?? "?"
    }/${humanAcceptanceReviewerKitVerification?.total ?? "?"}`,
    nextAction: "Run npm run verify:human-acceptance-reviewer-kit."
  });

  push(checks, {
    name: "Human acceptance reviewer invite is ready and locked",
    pass:
      humanAcceptanceReviewerInvite?.responseMode === "human_acceptance_reviewer_invite_json_v1" &&
      humanAcceptanceReviewerInvite.status === "ready_to_invite_reviewer" &&
      humanAcceptanceReviewerInvite.canInviteHumanReviewer === true &&
      (humanAcceptanceReviewerInvite.failedReasons?.length ?? -1) === 0 &&
      humanAcceptanceReviewerInvite.releaseDecision === "do_not_release" &&
      humanAcceptanceReviewerInvite.accepted === false &&
      humanAcceptanceReviewerInvite.packagingGated === true &&
      humanAcceptanceReviewerInvite.allSoftwareObjective === "paused",
    requiredForBeta: true,
    evidence: `status=${humanAcceptanceReviewerInvite?.status ?? "missing"}; canInvite=${
      humanAcceptanceReviewerInvite?.canInviteHumanReviewer ?? "missing"
    }`,
    nextAction: "Run npm run build:human-acceptance-reviewer-invite."
  });

  push(checks, {
    name: "Human acceptance reviewer invite verification is green",
    pass:
      humanAcceptanceReviewerInviteVerification?.responseMode ===
        "human_acceptance_reviewer_invite_verification_json_v1" &&
      humanAcceptanceReviewerInviteVerification.status === "passed" &&
      humanAcceptanceReviewerInviteVerification.passed === humanAcceptanceReviewerInviteVerification.total &&
      Number(humanAcceptanceReviewerInviteVerification.total ?? 0) >= 7 &&
      humanAcceptanceReviewerInviteVerification.releaseDecision === "do_not_release" &&
      humanAcceptanceReviewerInviteVerification.accepted === false &&
      humanAcceptanceReviewerInviteVerification.packagingGated === true &&
      humanAcceptanceReviewerInviteVerification.canRelease === false,
    requiredForBeta: true,
    evidence: `status=${humanAcceptanceReviewerInviteVerification?.status ?? "missing"}; checks=${
      humanAcceptanceReviewerInviteVerification?.passed ?? "?"
    }/${humanAcceptanceReviewerInviteVerification?.total ?? "?"}`,
    nextAction: "Run npm run verify:human-acceptance-reviewer-invite."
  });

  push(checks, {
    name: "Human acceptance receipt template is ready and locked",
    pass:
      humanAcceptanceReceiptValidation?.responseMode === "human_acceptance_receipt_validation_json_v1" &&
      humanAcceptanceReceiptValidation.status === "template_ready" &&
      humanAcceptanceReceiptValidation.mode === "template" &&
      humanAcceptanceReceiptValidation.passed === humanAcceptanceReceiptValidation.total &&
      Number(humanAcceptanceReceiptValidation.total ?? 0) >= 7 &&
      humanAcceptanceReceiptValidation.releaseDecision === "do_not_release" &&
      humanAcceptanceReceiptValidation.accepted === false &&
      humanAcceptanceReceiptValidation.packagingGated === true &&
      humanAcceptanceReceiptValidation.canRelease === false,
    requiredForBeta: true,
    evidence: `status=${humanAcceptanceReceiptValidation?.status ?? "missing"}; checks=${
      humanAcceptanceReceiptValidation?.passed ?? "?"
    }/${humanAcceptanceReceiptValidation?.total ?? "?"}`,
    nextAction:
      "Run npm run build:human-acceptance-receipt-template and npm run verify:human-acceptance-receipt."
  });

  push(checks, {
    name: "Manual acceptance classification resists bypass",
    pass:
      classification?.status === "passed" &&
      classification.passed === classification.total &&
      Number(classification.total ?? 0) >= 6,
    requiredForBeta: true,
    evidence: `status=${classification?.status ?? "missing"}; checks=${classification?.passed ?? "?"}/${
      classification?.total ?? "?"
    }`,
    nextAction: "Run npm run verify:manual-acceptance-classification."
  });

  push(checks, {
    name: "Release remains blocked while beta opens",
    pass:
      releaseReadiness?.status === "blocked_not_release_ready" &&
      releaseReadiness.releaseDecision === "do_not_release" &&
      releaseReadiness.boundary?.accepted === false &&
      releaseReadiness.boundary.packagingGated === true,
    requiredForBeta: true,
    evidence: `status=${releaseReadiness?.status ?? "missing"}; decision=${
      releaseReadiness?.releaseDecision ?? "missing"
    }; accepted=${releaseReadiness?.boundary?.accepted ?? "missing"}; packagingGated=${
      releaseReadiness?.boundary?.packagingGated ?? "missing"
    }`,
    nextAction: "Run npm run verify:product-release-readiness -- --allow-blocked."
  });

  push(checks, {
    name: "Productization evidence freshness is verified and locked",
    pass:
      productizationEvidenceFreshness?.responseMode === "productization_evidence_freshness_json_v1" &&
      productizationEvidenceFreshness.status === "passed" &&
      productizationEvidenceFreshness.releaseDecision === "do_not_release" &&
      productizationEvidenceFreshness.allSoftwareObjective === "paused" &&
      productizationEvidenceFreshness.accepted === false &&
      productizationEvidenceFreshness.packagingGated === true &&
      productizationEvidenceFreshness.canRelease === false &&
      productizationEvidenceFreshness.passed === productizationEvidenceFreshness.total &&
      Number(productizationEvidenceFreshness.total ?? 0) >= 8,
    requiredForBeta: true,
    evidence: `status=${productizationEvidenceFreshness?.status ?? "missing"}; checks=${
      productizationEvidenceFreshness?.passed ?? "?"
    }/${productizationEvidenceFreshness?.total ?? "?"}; release=${
      productizationEvidenceFreshness?.releaseDecision ?? "missing"
    }`,
    nextAction: "Run npm run verify:productization-evidence-freshness."
  });

  push(checks, {
    name: "Product status summary is ready and locked",
    pass:
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
      productStatusSummaryVerification.releaseDecision === "do_not_release" &&
      productStatusSummaryVerification.accepted === false &&
      productStatusSummaryVerification.packagingGated === true &&
      productStatusSummaryVerification.canRelease === false,
    requiredForBeta: true,
    evidence: `status=${productStatusSummary?.status ?? "missing"}; beta=${productStatusSummary?.betaCanStart ?? "missing"}; verification=${
      productStatusSummaryVerification?.status ?? "missing"
    } ${productStatusSummaryVerification?.passed ?? "?"}/${productStatusSummaryVerification?.total ?? "?"}`,
    nextAction: "Run npm run build:product-status-summary, npm run verify:product-status-summary, npm run build:product-takeover-matrix, npm run verify:product-takeover-matrix, npm run build:productization-launch-checklist, and npm run verify:productization-launch-checklist."
  });
  push(checks, {
    name: "Productization launch checklist is ready and locked",
    pass:
      productizationLaunchChecklist?.responseMode === "productization_launch_checklist_json_v1" &&
      productizationLaunchChecklist.status === "ready_for_controlled_launch" &&
      productizationLaunchChecklist.releaseDecision === "do_not_release" &&
      productizationLaunchChecklist.allSoftwareObjective === "paused" &&
      productizationLaunchChecklist.reviewOnly === true &&
      productizationLaunchChecklist.accepted === false &&
      productizationLaunchChecklist.packagingGated === true &&
      productizationLaunchChecklist.canRelease === false &&
      productizationLaunchChecklist.canActivateRealModel === false &&
      productizationLaunchChecklist.lanes?.some((lane) => lane.id === "bounded_beta_tester" && lane.allowed === true) === true &&
      productizationLaunchChecklist.blockedTransitions?.includes("release_product") === true &&
      productizationLaunchChecklistVerification?.responseMode === "productization_launch_checklist_verification_json_v1" &&
      productizationLaunchChecklistVerification.status === "passed" &&
      productizationLaunchChecklistVerification.passed === productizationLaunchChecklistVerification.total &&
      productizationLaunchChecklistVerification.releaseDecision === "do_not_release" &&
      productizationLaunchChecklistVerification.accepted === false &&
      productizationLaunchChecklistVerification.packagingGated === true &&
      productizationLaunchChecklistVerification.canRelease === false &&
      productizationLaunchChecklistVerification.canActivateRealModel === false,
    requiredForBeta: true,
    evidence: `status=${productizationLaunchChecklist?.status ?? "missing"}; verifier=${
      productizationLaunchChecklistVerification?.status ?? "missing"
    } ${productizationLaunchChecklistVerification?.passed ?? "?"}/${productizationLaunchChecklistVerification?.total ?? "?"}`,
    nextAction: "Run npm run build:productization-launch-checklist and npm run verify:productization-launch-checklist before contacting testers or reviewers."
  });
  push(checks, {
    name: "Product operator brief is ready and locked",
    pass:
      operatorBrief?.responseMode === "product_operator_brief_json_v1" &&
      operatorBrief.status === "ready_for_operator_handoff" &&
      operatorBrief.releaseDecision === "do_not_release" &&
      operatorBrief.reviewOnly === true &&
      operatorBrief.accepted === false &&
      operatorBrief.packagingGated === true &&
      operatorBrief.canRelease === false &&
      operatorBrief.canActivateRealModel === false &&
      operatorBrief.canInviteBoundedBetaTester === true &&
      operatorBrief.canStartHumanAcceptanceReview === true &&
      operatorBrief.canPlanRealModelTrial === true &&
      (operatorBrief.failedReasons?.length ?? -1) === 0 &&
      operatorBriefVerification?.responseMode === "product_operator_brief_verification_json_v1" &&
      operatorBriefVerification.status === "passed" &&
      operatorBriefVerification.passed === operatorBriefVerification.total &&
      Number(operatorBriefVerification.total ?? 0) >= 6 &&
      operatorBriefVerification.releaseDecision === "do_not_release" &&
      operatorBriefVerification.accepted === false &&
      operatorBriefVerification.packagingGated === true &&
      operatorBriefVerification.canRelease === false,
    requiredForBeta: true,
    evidence: `status=${operatorBrief?.status ?? "missing"}; beta=${
      operatorBrief?.canInviteBoundedBetaTester ?? "missing"
    }; human=${operatorBrief?.canStartHumanAcceptanceReview ?? "missing"}; modelTrial=${
      operatorBrief?.canPlanRealModelTrial ?? "missing"
    }; verification=${operatorBriefVerification?.status ?? "missing"} ${
      operatorBriefVerification?.passed ?? "?"
    }/${operatorBriefVerification?.total ?? "?"}`,
    nextAction: "Run npm run build:product-operator-brief and npm run verify:product-operator-brief."
  });

  push(checks, {
    name: "Release blocker board is ready and locked",
    pass:
      releaseBlockerBoard?.responseMode === "product_release_blocker_board_json_v1" &&
      releaseBlockerBoard.status === "ready_for_blocker_resolution" &&
      releaseBlockerBoard.releaseDecision === "do_not_release" &&
      releaseBlockerBoard.accepted === false &&
      releaseBlockerBoard.packagingGated === true &&
      releaseBlockerBoard.canRelease === false &&
      (releaseBlockerBoard.failedReasons?.length ?? -1) === 0 &&
      Number(releaseBlockerBoard.lanes?.length ?? 0) === 3,
    requiredForBeta: true,
    evidence: `status=${releaseBlockerBoard?.status ?? "missing"}; lanes=${
      releaseBlockerBoard?.lanes?.length ?? 0
    }; canRelease=${releaseBlockerBoard?.canRelease ?? "missing"}`,
    nextAction: "Run npm run build:product-release-blocker-board."
  });

  push(checks, {
    name: "Release blocker board verification is green",
    pass:
      releaseBlockerBoardVerification?.responseMode ===
        "product_release_blocker_board_verification_json_v1" &&
      releaseBlockerBoardVerification.status === "passed" &&
      releaseBlockerBoardVerification.passed === releaseBlockerBoardVerification.total &&
      Number(releaseBlockerBoardVerification.total ?? 0) >= 10 &&
      releaseBlockerBoardVerification.releaseDecision === "do_not_release" &&
      releaseBlockerBoardVerification.accepted === false &&
      releaseBlockerBoardVerification.packagingGated === true &&
      releaseBlockerBoardVerification.canRelease === false,
    requiredForBeta: true,
    evidence: `status=${releaseBlockerBoardVerification?.status ?? "missing"}; checks=${
      releaseBlockerBoardVerification?.passed ?? "?"
    }/${releaseBlockerBoardVerification?.total ?? "?"}`,
    nextAction: "Run npm run verify:product-release-blocker-board."
  });

  push(checks, {
    name: "Product release approval receipt template is ready and locked",
    pass:
      productReleaseApprovalValidation?.responseMode === "product_release_approval_validation_json_v1" &&
      productReleaseApprovalValidation.status === "template_ready" &&
      productReleaseApprovalValidation.mode === "template" &&
      productReleaseApprovalValidation.passed === productReleaseApprovalValidation.total &&
      Number(productReleaseApprovalValidation.total ?? 0) >= 7 &&
      productReleaseApprovalValidation.releaseDecision === "do_not_release" &&
      productReleaseApprovalValidation.accepted === false &&
      productReleaseApprovalValidation.packagingGated === true &&
      productReleaseApprovalValidation.canRelease === false,
    requiredForBeta: true,
    evidence: `status=${productReleaseApprovalValidation?.status ?? "missing"}; checks=${
      productReleaseApprovalValidation?.passed ?? "?"
    }/${productReleaseApprovalValidation?.total ?? "?"}`,
    nextAction:
      "Run npm run build:product-release-approval-template and npm run verify:product-release-approval, then process any returned release approval with npm run intake:product-release-approval-return before running npm run verify:product-release-approval-return-intake."
  });

  push(checks, {
    name: "Real model adapter contract is verified without real network",
    pass:
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
    requiredForBeta: true,
    evidence: `status=${realModelAdapterContract?.status ?? "missing"}; checks=${
      realModelAdapterContract?.passed ?? "?"
    }/${realModelAdapterContract?.total ?? "?"}; realNetwork=${realModelAdapterContract?.realNetworkUsed ?? "?"}`,
    nextAction: "Run npm run verify:real-model-adapter-contract."
  });

  push(checks, {
    name: "Real model trial kit is ready and locked",
    pass:
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
      Number(realModelTrialKit.credentialRedactionChecklist?.length ?? 0) === 4 &&
      realModelTrialKitRedactionIds.has("redacted_environment_summary") &&
      realModelTrialKitRedactionIds.has("artifact_secret_scan_before_return") &&
      realModelTrialKitRedactionIds.has("trial_log_minimization") &&
      realModelTrialKitRedactionIds.has("rollback_to_mock_after_trial") &&
      realModelTrialKit.evidenceToReturn?.some((item) => item.includes("Completed credential redaction checklist")) ===
        true &&
      realModelTrialKit.aiService?.activeProvider === "mock" &&
      realModelTrialKit.aiService.realModelReady === false,
    requiredForBeta: true,
    evidence: `status=${realModelTrialKit?.status ?? "missing"}; activeProvider=${
      realModelTrialKit?.aiService?.activeProvider ?? "missing"
    }; phases=${realModelTrialKit?.trialPhases?.length ?? 0}; redaction=${
      Array.from(realModelTrialKitRedactionIds).join(",") || "missing"
    }`,
    nextAction: "Run npm run build:real-model-trial-kit."
  });

  push(checks, {
    name: "Real model trial kit verification is green",
    pass:
      realModelTrialKitVerification?.responseMode === "real_model_trial_kit_verification_json_v1" &&
      realModelTrialKitVerification.status === "passed" &&
      realModelTrialKitVerification.passed === realModelTrialKitVerification.total &&
      Number(realModelTrialKitVerification.total ?? 0) >= 9 &&
      realModelTrialKitVerification.releaseDecision === "do_not_release" &&
      realModelTrialKitVerification.accepted === false &&
      realModelTrialKitVerification.packagingGated === true &&
      realModelTrialKitVerification.canActivateRealModel === false &&
      realModelTrialKitVerification.canRelease === false,
    requiredForBeta: true,
    evidence: `status=${realModelTrialKitVerification?.status ?? "missing"}; checks=${
      realModelTrialKitVerification?.passed ?? "?"
    }/${realModelTrialKitVerification?.total ?? "?"}`,
    nextAction: "Run npm run verify:real-model-trial-kit."
  });

  push(checks, {
    name: "Real model trial receipt template is ready and locked",
    pass:
      realModelTrialReceiptValidation?.responseMode === "real_model_trial_receipt_validation_json_v1" &&
      realModelTrialReceiptValidation.status === "template_ready" &&
      realModelTrialReceiptValidation.mode === "template" &&
      realModelTrialReceiptValidation.passed === realModelTrialReceiptValidation.total &&
      Number(realModelTrialReceiptValidation.total ?? 0) >= 7 &&
      realModelTrialReceiptValidation.releaseDecision === "do_not_release" &&
      realModelTrialReceiptValidation.accepted === false &&
      realModelTrialReceiptValidation.packagingGated === true &&
      realModelTrialReceiptValidation.canActivateRealModel === false &&
      realModelTrialReceiptValidation.canRelease === false,
    requiredForBeta: true,
    evidence: `status=${realModelTrialReceiptValidation?.status ?? "missing"}; checks=${
      realModelTrialReceiptValidation?.passed ?? "?"
    }/${realModelTrialReceiptValidation?.total ?? "?"}`,
    nextAction: "Run npm run build:real-model-trial-receipt-template and npm run verify:real-model-trial-receipt, then process any returned real-model trial receipt with npm run intake:real-model-trial-return before running npm run verify:real-model-trial-return-intake."
  });

  push(checks, {
    name: "Beta uses the bounded core loop, not all-software learning",
    pass: true,
    requiredForBeta: true,
    evidence: "Scope is bounded_core_teaching_loop; allSoftwareObjective=paused.",
    nextAction: "Keep all-software learning out of the public beta entry path."
  });

  push(checks, {
    name: "Public beta feedback API behavior is verified",
    pass:
      feedbackApiVerification?.responseMode === "public_beta_feedback_api_verification_json_v1" &&
      feedbackApiVerification.status === "passed" &&
      feedbackApiVerification.passed === feedbackApiVerification.total &&
      Number(feedbackApiVerification.total ?? 0) >= 5 &&
      feedbackApiVerification.releaseDecision === "do_not_release" &&
      feedbackApiVerification.accepted === false &&
      feedbackApiVerification.packagingGated === true &&
      feedbackApiVerification.tempArtifactsCleaned === true,
    requiredForBeta: true,
    evidence: `status=${feedbackApiVerification?.status ?? "missing"}; checks=${
      feedbackApiVerification?.passed ?? "?"
    }/${feedbackApiVerification?.total ?? "?"}; tempCleaned=${
      feedbackApiVerification?.tempArtifactsCleaned ?? "missing"
    }`,
    nextAction: "Run npm run verify:public-beta-feedback-api."
  });

  push(checks, {
    name: "Public beta feedback collection behavior is verified",
    pass:
      feedbackCollectionVerification?.responseMode ===
        "public_beta_feedback_collection_verification_json_v1" &&
      feedbackCollectionVerification.status === "passed" &&
      feedbackCollectionVerification.passed === feedbackCollectionVerification.total &&
      Number(feedbackCollectionVerification.total ?? 0) >= 7 &&
      feedbackCollectionVerification.releaseDecision === "do_not_release" &&
      feedbackCollectionVerification.accepted === false &&
      feedbackCollectionVerification.packagingGated === true,
    requiredForBeta: true,
    evidence: `status=${feedbackCollectionVerification?.status ?? "missing"}; checks=${
      feedbackCollectionVerification?.passed ?? "?"
    }/${feedbackCollectionVerification?.total ?? "?"}`,
    nextAction: "Run npm run verify:public-beta-feedback-collection."
  });

  push(checks, {
    name: "Public beta follow-up plan is generated and locked",
    pass:
      followUpPlan?.responseMode === "public_beta_follow_up_plan_json_v1" &&
      ["waiting_for_feedback", "ready_for_next_beta_tester"].includes(followUpPlan.status ?? "") &&
      followUpPlan.releaseDecision === "do_not_release" &&
      followUpPlan.accepted === false &&
      followUpPlan.packagingGated === true &&
      Number(followUpPlan.actions?.length ?? 0) >= 2,
    requiredForBeta: true,
    evidence: `status=${followUpPlan?.status ?? "missing"}; invite=${
      followUpPlan?.canInviteNextTester ?? "missing"
    }; actions=${followUpPlan?.actions?.length ?? "?"}`,
    nextAction: "Run npm run plan:public-beta-follow-up."
  });

  push(checks, {
    name: "Public beta follow-up plan behavior is verified",
    pass:
      followUpPlanVerification?.responseMode === "public_beta_follow_up_plan_verification_json_v1" &&
      followUpPlanVerification.status === "passed" &&
      followUpPlanVerification.passed === followUpPlanVerification.total &&
      Number(followUpPlanVerification.total ?? 0) >= 6 &&
      followUpPlanVerification.releaseDecision === "do_not_release" &&
      followUpPlanVerification.accepted === false &&
      followUpPlanVerification.packagingGated === true,
    requiredForBeta: true,
    evidence: `status=${followUpPlanVerification?.status ?? "missing"}; checks=${
      followUpPlanVerification?.passed ?? "?"
    }/${followUpPlanVerification?.total ?? "?"}`,
    nextAction: "Run npm run verify:public-beta-follow-up-plan."
  });

  push(checks, {
    name: "Public beta tester invite kit is ready and locked",
    pass:
      testerInvite?.responseMode === "public_beta_tester_invite_json_v1" &&
      testerInvite.status === "ready_to_invite" &&
      testerInvite.canInvite === true &&
      (testerInvite.failedReasons?.length ?? -1) === 0 &&
      testerInvite.releaseDecision === "do_not_release" &&
      testerInvite.accepted === false &&
      testerInvite.packagingGated === true &&
      Number(testerInvite.testerChecklist?.length ?? 0) >= 6 &&
      Number(testerInvite.maintainerChecklist?.length ?? 0) >= 6 &&
      testerInvite.launchPreflight?.requiredImmediatelyBeforeContact === true &&
      testerInvite.launchPreflight.command === "npm run preflight:public-beta-tester -- --base-url http://127.0.0.1:3000" &&
      testerInvite.launchPreflight.evidencePath === "artifacts/productization/public-beta-tester-session-preflight.json" &&
      testerInvite.launchPreflight.mustBeGeneratedAfterInvite === true &&
      testerInvite.launchPreflight.mustBeGeneratedAfterProductizationFreshness === true,
    requiredForBeta: true,
    evidence: `status=${testerInvite?.status ?? "missing"}; invite=${
      testerInvite?.canInvite ?? "missing"
    }; failed=${testerInvite?.failedReasons?.join(",") || "none"}`,
    nextAction: "Run npm run build:public-beta-tester-invite."
  });

  push(checks, {
    name: "Public beta tester invite kit is verified",
    pass:
      testerInviteVerification?.responseMode === "public_beta_tester_invite_verification_json_v1" &&
      testerInviteVerification.status === "passed" &&
      testerInviteVerification.passed === testerInviteVerification.total &&
      Number(testerInviteVerification.total ?? 0) >= 5 &&
      testerInviteVerification.releaseDecision === "do_not_release" &&
      testerInviteVerification.accepted === false &&
      testerInviteVerification.packagingGated === true,
    requiredForBeta: true,
    evidence: `status=${testerInviteVerification?.status ?? "missing"}; checks=${
      testerInviteVerification?.passed ?? "?"
    }/${testerInviteVerification?.total ?? "?"}`,
    nextAction: "Run npm run verify:public-beta-tester-invite."
  });

  push(checks, {
    name: "Public beta return intake behavior is verified",
    pass:
      returnIntakeVerification?.responseMode === "public_beta_return_intake_verification_json_v1" &&
      returnIntakeVerification.status === "passed" &&
      returnIntakeVerification.passed === returnIntakeVerification.total &&
      Number(returnIntakeVerification.total ?? 0) >= 3 &&
      returnIntakeVerification.releaseDecision === "do_not_release" &&
      returnIntakeVerification.accepted === false &&
      returnIntakeVerification.packagingGated === true,
    requiredForBeta: true,
    evidence: `status=${returnIntakeVerification?.status ?? "missing"}; checks=${
      returnIntakeVerification?.passed ?? "?"
    }/${returnIntakeVerification?.total ?? "?"}`,
    nextAction: "Run npm run verify:public-beta-return-intake."
  });

  push(checks, {
    name: "Human acceptance is ready to collect during beta",
    pass:
      humanAcceptance?.status === "blocked_needs_human_review" ||
      (humanAcceptance?.status === "passed" && humanAcceptance.latestEvidenceKind === "human_review"),
    requiredForBeta: false,
    evidence: `status=${humanAcceptance?.status ?? "missing"}; evidenceKind=${
      humanAcceptance?.latestEvidenceKind ?? "missing"
    }; humanReviewed=${humanAcceptance?.latestHumanReviewed ?? "missing"}; automationGenerated=${
      humanAcceptance?.latestAutomationGenerated ?? "missing"
    }`,
    nextAction: "Ask beta testers to save real /manual-test human_review evidence."
  });

  push(checks, {
    name: "Real model remains a controlled beta follow-up",
    pass:
      releaseReadiness?.boundary?.activeProvider === "mock" &&
      releaseReadiness.blockers?.some((blocker) => blocker.name === "Real model adapter is ready") === true,
    requiredForBeta: false,
    evidence: `activeProvider=${releaseReadiness?.boundary?.activeProvider ?? "missing"}`,
    nextAction: "Keep AI_PROVIDER=mock unless a real-model trial is separately accepted."
  });

  return checks;
}

function writeBetaStartHere(status: string) {
  const content = `# Transparent AI Apprentice Public Beta Packet

Status: \`${status}\`

This packet is for a local public beta of the bounded Web product loop. It is not a production release, packaging approval, or all-software learning claim.

## Beta Scope

- Stable demo task: \`task-photo-travel-journal\`
- Main loop: run task, inspect public trace, correct output, save rule, rerun, confirm learned behavior
- Runtime: local product mode via \`npm run start:product\`
- AI provider: \`mock\` by default
- Out of scope: all-software learning, unattended native desktop control, release packaging, technology acceptance

## Start The Beta Build

From the repository root:

\`\`\`bash
npm install
npm run setup:demo
npm run start:product -- --hostname 127.0.0.1 --port 3000
npm run prepare:public-beta -- --base-url http://127.0.0.1:3000
npm run verify:live-handoff -- --base-url http://127.0.0.1:3000
\`\`\`

Open:

- Public beta session: http://127.0.0.1:3000/public-beta
- Dashboard: http://127.0.0.1:3000
- Run page: http://127.0.0.1:3000/tasks/task-photo-travel-journal/run
- Review page: http://127.0.0.1:3000/tasks/task-photo-travel-journal/review
- Manual beta feedback workbench: http://127.0.0.1:3000/manual-test

## Launch Preflight Before Contact

Do not contact a tester until this command has just passed against the live URL you will give them:

\`\`\`bash
npm run preflight:public-beta-tester -- --base-url http://127.0.0.1:3000
\`\`\`

Required evidence: \`artifacts/productization/public-beta-tester-session-preflight.json\`

Stop if the preflight is missing, stale, failed, or changes \`releaseDecision=do_not_release\`.

## Tester Script

1. Open \`http://127.0.0.1:3000/public-beta\` and use it as the session guide.
2. Use the Run stable task action to run the photography journal task once.
3. Inspect the structured public trace.
4. Submit one correction.
5. Confirm the new rule appears with source/provenance.
6. Rerun and check whether learned behavior changed the output.
7. Open \`/manual-test\`, enter reviewer name, mark each step, write notes, attest real human review, and save evidence.
8. Fill or save the public beta feedback receipt from \`/public-beta\` and return it to the maintainer.

## Maintainer Commands

\`\`\`bash
npm run doctor:product
npm run verify:product
npm run smoke:product -- --base-url http://127.0.0.1:3000
npm run cleanup:runtime-artifacts -- --apply
npm run verify:live-handoff -- --base-url http://127.0.0.1:3000
npm run preflight:human-acceptance -- --base-url http://127.0.0.1:3000
npm run build:human-acceptance-reviewer-kit
npm run verify:human-acceptance-reviewer-kit
npm run build:human-acceptance-reviewer-invite
npm run verify:human-acceptance-reviewer-invite
npm run build:human-acceptance-receipt-template
npm run verify:human-acceptance-receipt
npm run build:product-status-summary
npm run verify:product-status-summary
npm run build:product-takeover-matrix
npm run verify:product-takeover-matrix
npm run verify:productization-evidence-freshness
npm run build:product-operator-brief
npm run verify:product-operator-brief
npm run build:product-release-blocker-board
npm run verify:product-release-blocker-board
npm run build:product-release-approval-template
npm run verify:product-release-approval
npm run intake:product-release-approval-return -- --receipt path/to/filled-product-release-approval.json
npm run verify:product-release-approval-return-intake
npm run verify:real-model-adapter-contract
npm run build:real-model-trial-kit
npm run verify:real-model-trial-kit
npm run build:real-model-trial-receipt-template
npm run verify:real-model-trial-receipt
npm run intake:real-model-trial-return -- --receipt path/to/filled-real-model-trial-receipt.json
npm run verify:real-model-trial-return-intake
npm run verify:human-acceptance
npm run verify:product-release-readiness -- --allow-blocked
npm run prepare:public-beta -- --base-url http://127.0.0.1:3000
npm run package:public-beta
npm run verify:public-beta
npm run verify:public-beta-feedback
npm run verify:public-beta-feedback-api
npm run smoke:public-beta-browser -- --base-url http://127.0.0.1:3000
npm run verify:public-beta-feedback -- --receipt path/to/submitted-feedback.json
npm run verify:public-beta-feedback-collection
npm run collect:public-beta-feedback
npm run plan:public-beta-follow-up
npm run verify:public-beta-follow-up-plan
npm run build:public-beta-tester-invite
npm run verify:public-beta-tester-invite
npm run preflight:public-beta-tester -- --base-url http://127.0.0.1:3000
npm run intake:public-beta-return -- --receipt path/to/submitted-feedback.json --session-receipt path/to/filled-public-beta-session-receipt.json --send-receipt-validation artifacts/productization/first-real-tester-send-receipt-validation.json
npm run verify:public-beta-return-intake
\`\`\`

## Included Evidence

- \`evidence/product-verification-receipt.json\`
- \`evidence/product-ui-api-smoke.json\`
- \`evidence/product-runtime-verification.json\`
- \`evidence/product-runtime-doctor.json\`
- \`evidence/product-handoff-readiness.json\`
- \`evidence/product-release-readiness.json\`
- \`evidence/productization-evidence-freshness.json\`
- \`evidence/product-status-summary.json\`
- \`evidence/product-status-summary-verification.json\`
- \`docs/PRODUCT_STATUS_SUMMARY.md\`
- \`evidence/productization-launch-checklist.json\`
- \`evidence/productization-launch-checklist-verification.json\`
- \`docs/PRODUCTIZATION_LAUNCH_CHECKLIST.md\`
- \`evidence/product-operator-brief.json\`
- \`evidence/product-operator-brief-verification.json\`
- \`docs/PRODUCT_OPERATOR_BRIEF.md\`
- \`evidence/product-takeover-decision-matrix.json\`
- \`evidence/product-takeover-decision-matrix-verification.json\`
- \`docs/PRODUCT_TAKEOVER_DECISION_MATRIX.md\`
- \`evidence/product-release-blocker-board.json\`
- \`evidence/product-release-blocker-board-verification.json\`
- \`docs/PRODUCT_RELEASE_BLOCKER_BOARD.md\`
- \`docs/PRODUCT_RELEASE_APPROVAL.template.json\`
- \`docs/PRODUCT_RELEASE_APPROVAL_TEMPLATE.md\`
- \`evidence/product-release-approval-validation.json\`
- \`evidence/real-model-trial-kit.json\`
- \`evidence/real-model-trial-kit-verification.json\`
- \`docs/REAL_MODEL_TRIAL_KIT.md\`
- \`evidence/real-model-adapter-contract-verification.json\`
- \`docs/REAL_MODEL_TRIAL_RECEIPT.template.json\`
- \`docs/REAL_MODEL_TRIAL_RECEIPT_TEMPLATE.md\`
- \`evidence/real-model-trial-receipt-validation.json\`
- \`evidence/runtime-artifact-cleanup.json\`
- \`evidence/live-product-handoff.json\`
- \`evidence/public-beta-readiness.json\`
- \`evidence/public-beta-feedback-receipt-validation.json\`
- \`evidence/public-beta-feedback-api-verification.json\`
- \`evidence/public-beta-browser-smoke.json\`
- \`evidence/public-beta-browser-desktop.png\`
- \`evidence/public-beta-browser-mobile.png\`
- \`evidence/public-beta-feedback-collection.json\`
- \`evidence/public-beta-feedback-collection-verification.json\`
- \`evidence/public-beta-follow-up-plan.json\`
- \`evidence/public-beta-follow-up-plan-verification.json\`
- \`evidence/public-beta-tester-invite.json\`
- \`evidence/public-beta-tester-invite-verification.json\`
- \`evidence/public-beta-tester-session-preflight.json\` when generated after the latest freshness receipt
- \`evidence/public-beta-return-intake-verification.json\`
- \`evidence/public-beta-preparation.json\`
- \`evidence/human-acceptance-gate.json\`
- \`evidence/human-acceptance-session-preflight.json\`
- \`evidence/human-acceptance-reviewer-kit.json\`
- \`evidence/human-acceptance-reviewer-kit-verification.json\`
- \`docs/HUMAN_ACCEPTANCE_REVIEWER_KIT.md\`
- \`evidence/human-acceptance-reviewer-invite.json\`
- \`evidence/human-acceptance-reviewer-invite-verification.json\`
- \`docs/HUMAN_ACCEPTANCE_REVIEWER_INVITE.md\`
- \`docs/HUMAN_ACCEPTANCE_RECEIPT.template.json\`
- \`docs/HUMAN_ACCEPTANCE_RECEIPT_TEMPLATE.md\`
- \`evidence/human-acceptance-receipt-validation.json\`
- \`evidence/manual-acceptance-classification-verification.json\`
- \`evidence/manual-acceptance-latest.json\`
- \`evidence/product-trial-manifest.json\`
- \`evidence/product-trial-packet-verification.json\` ensured by \`npm run package:public-beta\` and independently refreshable with \`npm run verify:product-trial\`

## Optional Evidence Generated After Returns

These files appear only after a real tester or reviewer returns a filled receipt and the maintainer runs the matching intake command. Their absence before the first return is expected.

- \`evidence/public-beta-return-intake.json\` appears only after \`npm run intake:public-beta-return -- --receipt path/to/submitted-feedback.json --session-receipt path/to/filled-public-beta-session-receipt.json --send-receipt-validation artifacts/productization/first-real-tester-send-receipt-validation.json\`.
- \`evidence/human-acceptance-return-intake.json\` appears only after \`npm run intake:human-acceptance-return -- --receipt path/to/filled-human-acceptance-receipt.json --send-receipt-validation artifacts/productization/first-real-tester-send-receipt-validation.json\`; then run \`npm run verify:human-acceptance-return-intake\` and, only after it passes, run the intake receipt's \`postIntakeRefresh.commandSequence\` before relying on refreshed handoff files.

## Feedback Templates

- \`docs/PUBLIC_BETA_TESTER_RUNBOOK.md\`
- \`docs/PUBLIC_BETA_FEEDBACK_TEMPLATE.md\`
- \`docs/PUBLIC_BETA_FEEDBACK_RECEIPT.template.json\`
- \`docs/PUBLIC_BETA_TESTER_INVITE.md\`
- \`docs/HUMAN_ACCEPTANCE_REVIEWER_KIT.md\`
- \`docs/HUMAN_ACCEPTANCE_REVIEWER_INVITE.md\`
- \`docs/HUMAN_ACCEPTANCE_RECEIPT.template.json\`
- \`docs/HUMAN_ACCEPTANCE_RECEIPT_TEMPLATE.md\`
- \`docs/PRODUCT_TAKEOVER_DECISION_MATRIX.md\`
- \`docs/PRODUCTIZATION_LAUNCH_CHECKLIST.md\`
- \`docs/PRODUCT_STATUS_SUMMARY.md\`
- \`docs/PRODUCT_OPERATOR_BRIEF.md\`
- \`docs/PRODUCT_RELEASE_BLOCKER_BOARD.md\`
- \`docs/PRODUCT_RELEASE_APPROVAL.template.json\`
- \`docs/PRODUCT_RELEASE_APPROVAL_TEMPLATE.md\`
- \`docs/REAL_MODEL_TRIAL_KIT.md\`
- \`evidence/real-model-adapter-contract-verification.json\`
- \`docs/REAL_MODEL_TRIAL_RECEIPT.template.json\`
- \`docs/REAL_MODEL_TRIAL_RECEIPT_TEMPLATE.md\`

Validate the generated JSON template with \`npm run verify:public-beta-feedback\`. After a tester submits a filled JSON receipt, validate it with \`npm run verify:public-beta-feedback -- --receipt path/to/submitted-feedback.json\`.
When \`npm run package:public-beta\` runs, it ensures the product trial packet has \`evidence/product-trial-packet-verification.json\` and embeds it in the beta packet; run \`npm run verify:public-beta\` to prove the packaged manifest and verification receipt are current. Use \`npm run verify:product-trial\` only when separately rebuilding or auditing the product trial packet.
Run \`npm run preflight:human-acceptance -- --base-url http://127.0.0.1:3000\` before asking a reviewer to save real \`human_review\` evidence; it checks /manual-test, the manual acceptance API, current gate state, and release locks without saving human_review evidence.
Run \`npm run build:human-acceptance-reviewer-kit\` and \`npm run verify:human-acceptance-reviewer-kit\`, then keep \`docs/HUMAN_ACCEPTANCE_REVIEWER_KIT.md\` as the detailed reviewer kit.
Run \`npm run build:human-acceptance-reviewer-invite\` and \`npm run verify:human-acceptance-reviewer-invite\`, then give \`docs/HUMAN_ACCEPTANCE_REVIEWER_INVITE.md\` to the real reviewer as the sendable review-start material; it is not acceptance.
Run \`npm run build:human-acceptance-receipt-template\` and \`npm run verify:human-acceptance-receipt\`, then validate any filled human acceptance receipt with \`npm run verify:human-acceptance-receipt -- --receipt path/to/filled-human-acceptance-receipt.json\`.
Process returned human acceptance receipts with \`npm run intake:human-acceptance-return -- --receipt path/to/filled-human-acceptance-receipt.json --send-receipt-validation artifacts/productization/first-real-tester-send-receipt-validation.json\`, then run \`npm run verify:human-acceptance-return-intake\`; only after that verifier passes, run the intake receipt's \`postIntakeRefresh.commandSequence\` before relying on refreshed reviewer invite, blocker board, status summary, takeover matrix, or evidence freshness files.
Run \`npm run build:product-takeover-matrix\`, \`npm run verify:product-takeover-matrix\`, \`npm run build:productization-launch-checklist\`, \`npm run verify:productization-launch-checklist\`, \`npm run build:product-status-summary\`, \`npm run verify:product-status-summary\`, and \`npm run verify:productization-evidence-freshness\` when a maintainer needs the first-read takeover matrix, controlled launch checklist, one-page beta-ready/release-blocked status, and coherent evidence timeline.
Run \`npm run build:product-operator-brief\` and \`npm run verify:product-operator-brief\` when a maintainer needs the concise next-step handoff for tester invite, human acceptance, and real-model trial planning.
Run \`npm run build:product-release-blocker-board\` and \`npm run verify:product-release-blocker-board\` to review the remaining release blockers without unlocking release.
Run \`npm run build:product-release-approval-template\` and \`npm run verify:product-release-approval\`, then process any filled release approval receipt with \`npm run intake:product-release-approval-return -- --receipt path/to/filled-product-release-approval.json\` and run \`npm run verify:product-release-approval-return-intake\`; this remains separate release-review evidence.
Run \`npm run verify:real-model-adapter-contract\`, then run \`npm run build:real-model-trial-kit\` and \`npm run verify:real-model-trial-kit\`. Use \`docs/REAL_MODEL_TRIAL_KIT.md\` before any real provider trial; it does not activate a real model or unlock release.
Run \`npm run build:real-model-trial-receipt-template\` and \`npm run verify:real-model-trial-receipt\`, then process any filled real-model trial receipt with \`npm run intake:real-model-trial-return -- --receipt path/to/filled-real-model-trial-receipt.json\` and run \`npm run verify:real-model-trial-return-intake\`.
Run \`npm run verify:public-beta-feedback-api\` to prove dry-run validation, browser-style saving, invalid rejection, and blocked-feedback safeguards without changing the real inbox.
Run \`npm run smoke:public-beta-browser -- --base-url http://127.0.0.1:3000\` before inviting a tester whenever the /public-beta entry or feedback workbench changes; it captures desktop/mobile evidence and proves dry-run validation does not grow the inbox.
Do not hand-copy externally returned tester receipts into \`artifacts/productization/public-beta-feedback-inbox/\`. Run \`npm run intake:public-beta-return -- --receipt path/to/submitted-feedback.json --session-receipt path/to/filled-public-beta-session-receipt.json --send-receipt-validation artifacts/productization/first-real-tester-send-receipt-validation.json\`; it validates the feedback receipt plus session receipt, requires the same tester.name/tester.date across both receipts and sessionEvidence.feedbackReceiptPath pointing at the submitted feedback receipt, archives both review-only receipts, refreshes collection, and refreshes the follow-up plan. Use \`npm run collect:public-beta-feedback\` only to audit or refresh the current inbox queue after intake or browser-submitted feedback.
Run \`npm run verify:public-beta-feedback-collection\` to prove empty, ready, needs-fix, blocked, and invalid feedback receipts are classified correctly before relying on the real inbox queue.
Run \`npm run plan:public-beta-follow-up\` after collection to turn inbox state into the next tester-intake, fix-planning, blocker-review, and release-lock actions.
Use \`docs/PUBLIC_BETA_TESTER_INVITE.md\` as the maintainer-facing invite copy for one bounded beta tester.
Immediately before contacting the tester, run \`npm run preflight:public-beta-tester -- --base-url http://127.0.0.1:3000\` to prove the live URL, tester pages, invite state, return-intake path, and release lock are ready.
When a tester returns filled JSON receipts, run \`npm run intake:public-beta-return -- --receipt path/to/submitted-feedback.json --session-receipt path/to/filled-public-beta-session-receipt.json --send-receipt-validation artifacts/productization/first-real-tester-send-receipt-validation.json\` to validate both returned receipts, confirm the same tester.name/tester.date and sessionEvidence.feedbackReceiptPath, archive them together, refresh collection, and refresh the follow-up plan.

## Boundary

For beta, \`releaseDecision=do_not_release\` is expected. The beta can begin when the bounded product verification is green and packaging remains locked.
`;

  fs.writeFileSync(path.join(packetDir, "START_PUBLIC_BETA.md"), content);
}

function writeTesterRunbook(status: string) {
  const content = [
    "# Public Beta Tester Runbook",
    "",
    "Status: `" + status + "`",
    "",
    "Use this file if you are the bounded beta tester. It keeps maintainer-only commands out of the way and focuses on the product session you should actually run.",
    "",
    "## What You Need",
    "",
    "- A running local product server from the maintainer.",
    "- Public beta session: http://127.0.0.1:3000/public-beta",
    "- Stable task page: http://127.0.0.1:3000/tasks/task-photo-travel-journal/run",
    "- Manual review page: http://127.0.0.1:3000/manual-test",
    "- About 20 to 30 minutes and permission to return notes/screenshots for this beta only.",
    "",
    "## Test Script",
    "",
    "1. Open http://127.0.0.1:3000/public-beta.",
    "2. Use the stable task action to run `task-photo-travel-journal` once.",
    "3. Inspect the public trace and check that steps, rules, confidence, validation results, and review points are understandable without private reasoning.",
    "4. Submit one correction from the product UI.",
    "5. Confirm the new rule or memory evidence is visible with source/provenance.",
    "6. Rerun the stable task and check whether behavior changed in the expected direction.",
    "7. Open http://127.0.0.1:3000/manual-test, enter reviewer notes, attest real human review, and save `evidenceKind=human_review` evidence.",
    "8. Return to http://127.0.0.1:3000/public-beta, save or download the feedback receipt, and send it back with notes or screenshots; the facilitator/maintainer fills the whole-session receipt and binds it to your submitted feedback receipt.",
    "",
    "## Return To Maintainer",
    "",
    "- Filled public beta feedback receipt JSON.",
    "- Facilitator-filled whole-session receipt JSON from `docs/PUBLIC_BETA_SESSION_RECEIPT.template.json`, bound to the tester feedback receipt by tester.name/tester.date and sessionEvidence.feedbackReceiptPath.",
    "- Confirmation that `/manual-test` saved real `human_review` evidence, or a note explaining why it could not be saved.",
    "- Screenshot or short note for any blocker, confusing wording, missing product behavior, or trust concern.",
    "",
    "## Boundary",
    "",
    "- This beta is review-only.",
    "- Your feedback is not production release approval.",
    "- Your feedback does not unlock packaging.",
    "- Your feedback does not accept a real model provider.",
    "- Your feedback does not resume the all-software objective.",
    "- Expected release decision remains `do_not_release`.",
    ""
  ].join("\n");

  fs.writeFileSync(path.join(docsDir, "PUBLIC_BETA_TESTER_RUNBOOK.md"), content);
}
function writeFeedbackTemplate() {
  const content = `# Public Beta Feedback Template

Tester:
Date:
Environment:

## Setup

- Could you start the app with \`npm run start:product\`?
- Did \`/api/health\` report healthy?

## Core Loop

- Did the first run produce a clear structured result?
- Did the public trace explain what happened without hidden reasoning?
- What correction did you submit?
- Did rerun behavior change in the expected way?

## Trust And Transparency

- Was it clear what the apprentice learned?
- Was it clear what remained locked or review-only?
- Did any page imply release, packaging, or all-software control was complete?

## Blockers

- Blocking issue:
- Confusing wording:
- Missing product behavior:
- Screenshot or evidence path:

## Beta Decision

Choose one:

- ready_for_next_beta_tester
- needs_fix_before_more_testers
- blocked
`;

  fs.writeFileSync(path.join(docsDir, "PUBLIC_BETA_FEEDBACK_TEMPLATE.md"), content);
}

function writeFeedbackReceiptTemplate() {
  const template = {
    responseMode: "public_beta_feedback_receipt_template_json_v1",
    status: "not_filled_yet",
    productScope: "bounded_core_teaching_loop",
    allSoftwareObjective: "paused",
    releaseDecision: "do_not_release",
    betaDecisionAllowedValues: ["ready_for_next_beta_tester", "needs_fix_before_more_testers", "blocked"],
    defaultBetaDecision: "needs_fix_before_more_testers",
    reviewOnly: true,
    accepted: false,
    packagingGated: true,
    tester: {
      name: "",
      role: "",
      date: "",
      environment: ""
    },
    setup: {
      couldStartProductRuntime: null,
      healthEndpointHealthy: null,
      liveHandoffChecked: null,
      notes: ""
    },
    coreLoop: {
      firstRunClear: null,
      traceUnderstandable: null,
      correctionSubmitted: null,
      ruleProvenanceVisible: null,
      rerunChangedBehavior: null,
      notes: ""
    },
    trustAndBoundaries: {
      learnedBehaviorClear: null,
      reviewOnlyBoundaryClear: null,
      noReleaseOrAllSoftwareClaim: null,
      notes: ""
    },
    blockers: {
      blockingIssue: "",
      confusingWording: "",
      missingProductBehavior: "",
      screenshotOrEvidencePath: ""
    },
    betaDecision: "needs_fix_before_more_testers",
    nextActionRecommendation: "",
    locks: {
      mustNotSaveAcceptance: true,
      mustNotEnableRules: true,
      mustNotUnlockPackaging: true,
      mustNotClaimReleaseReady: true,
      mustNotResumeAllSoftwareObjective: true
    }
  };

  fs.writeFileSync(path.join(docsDir, "PUBLIC_BETA_FEEDBACK_RECEIPT.template.json"), JSON.stringify(template, null, 2));
}

function ensureVerifiedProductTrialPacket() {
  const trialManifestPath = path.join(
    process.cwd(),
    "artifacts/productization/product-trial-packet/product-trial-manifest.json"
  );
  const trialVerificationPath = path.join(
    process.cwd(),
    "artifacts/productization/product-trial-packet/evidence/product-trial-packet-verification.json"
  );

  if (!fs.existsSync(trialManifestPath)) {
    buildProductTrialPacket("public-beta-dependency");
  }

  if (!fs.existsSync(trialVerificationPath)) {
    const receipt = verifyProductTrialPacket({ log: false });
    if (receipt.status !== "passed") {
      throw new Error(
        `Product trial packet verification failed before public beta packaging: ${receipt.passed}/${receipt.total}`
      );
    }
  }
}

export function buildPublicBetaPacket(source = "manual") {
  ensureVerifiedProductTrialPacket();

  fs.rmSync(packetDir, { recursive: true, force: true });
  fs.mkdirSync(docsDir, { recursive: true });
  fs.mkdirSync(evidenceDir, { recursive: true });

  const readinessChecks = buildReadinessChecks();
  const requiredChecks = readinessChecks.filter((check) => check.requiredForBeta);
  const failedRequired = requiredChecks.filter((check) => !check.pass);
  const status = failedRequired.length === 0 ? "ready_for_public_beta" : "not_ready_for_public_beta";
  const includedFiles = [...docFiles, ...evidenceFiles]
    .map(copyFile)
    .filter((file): file is NonNullable<typeof file> => Boolean(file));

  writeBetaStartHere(status);
  writeFeedbackTemplate();
  writeFeedbackReceiptTemplate();
  writeTesterRunbook(status);
  const generatedFiles = [
    generatedFile("START_PUBLIC_BETA.md", "tester_entrypoint"),
    generatedFile("docs/PUBLIC_BETA_TESTER_RUNBOOK.md", "tester_runbook"),
    generatedFile("docs/PUBLIC_BETA_FEEDBACK_TEMPLATE.md", "human_readable_feedback_template"),
    generatedFile("docs/PUBLIC_BETA_FEEDBACK_RECEIPT.template.json", "machine_readable_feedback_receipt_template")
  ];

  const manifest = {
    responseMode: "public_beta_packet_manifest_json_v1",
    status,
    generatedAt: new Date().toISOString(),
    source,
    packetDir: "artifacts/productization/public-beta-packet",
    productScope: "bounded_core_teaching_loop",
    allSoftwareObjective: "paused",
    releaseDecision: "do_not_release",
    betaCanStart: status === "ready_for_public_beta",
    requiredPassed: requiredChecks.length - failedRequired.length,
    requiredTotal: requiredChecks.length,
    blockers: failedRequired.map((check) => ({
      name: check.name,
      evidence: check.evidence,
      nextAction: check.nextAction
    })),
    readinessChecks,
    entrypoints: {
      startHere: "artifacts/productization/public-beta-packet/START_PUBLIC_BETA.md",
      testerRunbook: "artifacts/productization/public-beta-packet/docs/PUBLIC_BETA_TESTER_RUNBOOK.md",
      feedbackMarkdownTemplate: "artifacts/productization/public-beta-packet/docs/PUBLIC_BETA_FEEDBACK_TEMPLATE.md",
      feedbackReceiptTemplate: "artifacts/productization/public-beta-packet/docs/PUBLIC_BETA_FEEDBACK_RECEIPT.template.json",
      testerInvite: "artifacts/productization/public-beta-packet/docs/PUBLIC_BETA_TESTER_INVITE.md",
      publicBetaSessionPlan: "artifacts/productization/public-beta-packet/docs/PUBLIC_BETA_SESSION_PLAN.md",
      publicBetaSessionReceiptTemplate: "artifacts/productization/public-beta-packet/docs/PUBLIC_BETA_SESSION_RECEIPT.template.json",
      humanAcceptanceReviewerKit:
        "artifacts/productization/public-beta-packet/docs/HUMAN_ACCEPTANCE_REVIEWER_KIT.md",
      humanAcceptanceReviewerInvite:
        "artifacts/productization/public-beta-packet/docs/HUMAN_ACCEPTANCE_REVIEWER_INVITE.md",
      humanAcceptanceReceiptTemplate:
        "artifacts/productization/public-beta-packet/docs/HUMAN_ACCEPTANCE_RECEIPT.template.json",
      productTakeoverDecisionMatrix:
        "artifacts/productization/public-beta-packet/docs/PRODUCT_TAKEOVER_DECISION_MATRIX.md",
      productizationLaunchChecklist:
        "artifacts/productization/public-beta-packet/docs/PRODUCTIZATION_LAUNCH_CHECKLIST.md",
      productStatusSummary: "artifacts/productization/public-beta-packet/docs/PRODUCT_STATUS_SUMMARY.md",
      productOperatorBrief: "artifacts/productization/public-beta-packet/docs/PRODUCT_OPERATOR_BRIEF.md",
      productReleaseBlockerBoard:
        "artifacts/productization/public-beta-packet/docs/PRODUCT_RELEASE_BLOCKER_BOARD.md",
      productReleaseApprovalTemplate:
        "artifacts/productization/public-beta-packet/docs/PRODUCT_RELEASE_APPROVAL.template.json",
      realModelTrialKit: "artifacts/productization/public-beta-packet/docs/REAL_MODEL_TRIAL_KIT.md",
      realModelTrialReceiptTemplate:
        "artifacts/productization/public-beta-packet/docs/REAL_MODEL_TRIAL_RECEIPT.template.json",
      publicBeta: "http://127.0.0.1:3000/public-beta",
      dashboard: "http://127.0.0.1:3000",
      runPage: "http://127.0.0.1:3000/tasks/task-photo-travel-journal/run",
      manualAcceptance: "http://127.0.0.1:3000/manual-test"
    },
    testerLaunchGate: {
      requiredImmediatelyBeforeContact: true,
      command: "npm run preflight:public-beta-tester -- --base-url http://127.0.0.1:3000",
      evidencePath: "artifacts/productization/public-beta-tester-session-preflight.json",
      startHereSection: "Launch Preflight Before Contact",
      stopIf:
        "Do not contact a tester if the live preflight is missing, stale, failed, or releaseDecision is not do_not_release."
    },
    packagingBoundary: {
      accepted: false,
      packagingGated: true,
      status: "pending_teacher_acceptance"
    },
    includedFiles,
    generatedFiles,
    betaCollectionTargets: [
      "Use /public-beta and PUBLIC_BETA_TESTER_RUNBOOK.md as the primary tester-facing session guide before jumping into internal evidence docs.",
      "At least one real tester saves /manual-test evidenceKind=human_review.",
      "Run npm run preflight:human-acceptance before asking a reviewer to save human_review evidence.",
      "Run npm run build:human-acceptance-reviewer-kit and npm run verify:human-acceptance-reviewer-kit before relying on the reviewer kit.",
      "Run npm run build:human-acceptance-reviewer-invite and npm run verify:human-acceptance-reviewer-invite before giving HUMAN_ACCEPTANCE_REVIEWER_INVITE.md to a real reviewer.",
      "Use HUMAN_ACCEPTANCE_RECEIPT.template.json and npm run verify:human-acceptance-receipt before relying on human acceptance reviewer evidence.",
      "Process returned human acceptance reviewer receipts with npm run intake:human-acceptance-return -- --receipt <path> --send-receipt-validation artifacts/productization/first-real-tester-send-receipt-validation.json, then run npm run verify:human-acceptance-return-intake; only after it passes, run the intake receipt's postIntakeRefresh.commandSequence before relying on refreshed handoff files.",
      "Open PRODUCT_TAKEOVER_DECISION_MATRIX.md first to choose one allowed next action and see stop conditions.",
      "Open PRODUCTIZATION_LAUNCH_CHECKLIST.md next to confirm the controlled launch gate, live preflights, allowed lanes, and blocked release transitions.",
      "Open PRODUCT_STATUS_SUMMARY.md after the launch checklist to see the current beta-ready but release-blocked status.",
      "Check evidence/productization-evidence-freshness.json before inviting a tester so the release gate, blocker board, operator brief, takeover matrix, controlled launch checklist, and status summary are from one coherent refresh sequence.",
      "Use PRODUCT_OPERATOR_BRIEF.md as the concise maintainer handoff before inviting a tester or planning acceptance work.",
      "Use PRODUCT_RELEASE_BLOCKER_BOARD.md to resolve release blockers while releaseDecision remains do_not_release.",
      "Use PRODUCT_RELEASE_APPROVAL.template.json and npm run verify:product-release-approval only for separate release-review evidence after human and model acceptance.",
      "Process returned release-review receipts with npm run intake:product-release-approval-return -- --receipt <path>, then run npm run verify:product-release-approval-return-intake.",
      "Keep real-model-adapter-contract-verification.json green before planning any real-provider trial.",
      "Use REAL_MODEL_TRIAL_KIT.md and npm run verify:real-model-trial-kit before any real-provider trial.",
      "Use REAL_MODEL_TRIAL_RECEIPT.template.json and npm run verify:real-model-trial-receipt before collecting real-provider trial evidence.",
      "Process returned real-model trial receipts with npm run intake:real-model-trial-return -- --receipt <path>, then run npm run verify:real-model-trial-return-intake before relying on real-provider trial evidence.",
      "Collect confusion points from PUBLIC_BETA_FEEDBACK_TEMPLATE.md.",
      "Validate any filled PUBLIC_BETA_FEEDBACK_RECEIPT JSON with npm run verify:public-beta-feedback -- --receipt <path>.",
      "Verify browser feedback receipt save behavior with npm run verify:public-beta-feedback-api.",
      "Capture /public-beta feedback workbench browser evidence with npm run smoke:public-beta-browser when the entry UI changes.",
      "Process returned beta feedback receipts with npm run intake:public-beta-return -- --receipt <path> --session-receipt <session-receipt-path> --send-receipt-validation artifacts/productization/first-real-tester-send-receipt-validation.json; the facilitator/maintainer-filled whole-session receipt must share the same tester.name/tester.date, its sessionEvidence.feedbackReceiptPath must point at the submitted feedback receipt, and npm run collect:public-beta-feedback is only for auditing or refreshing the queue after intake or browser-submitted feedback.",
      "Plan beta follow-up with npm run plan:public-beta-follow-up before inviting another tester.",
      "Use the verified PUBLIC_BETA_TESTER_INVITE.md before contacting one bounded beta tester.",
      "Use PUBLIC_BETA_SESSION_PLAN.md as the facilitator script for the first real tester session, including stop conditions and return-intake commands.",
      "Have the facilitator/maintainer use PUBLIC_BETA_SESSION_RECEIPT.template.json to record the full tester session, including live preflight, manual-test evidence, feedback receipt path, return-intake status, and blockers.",
      "Run npm run preflight:public-beta-tester immediately before contacting the tester.",
      "Process returned tester feedback plus facilitator-filled whole-session receipts with npm run intake:public-beta-return -- --receipt <path> --session-receipt <session-receipt-path> --send-receipt-validation artifacts/productization/first-real-tester-send-receipt-validation.json before inviting another tester; mismatched tester.name/tester.date or feedbackReceiptPath must stay rejected.",
      "Keep release readiness blocked until human acceptance, real-model trial acceptance, and packaging approval are explicit."
    ]
  };

  fs.writeFileSync(path.join(packetDir, "public-beta-manifest.json"), JSON.stringify(manifest, null, 2));
  return manifest;
}

const currentFile = fileURLToPath(import.meta.url);
if (path.resolve(process.argv[1] ?? "") === currentFile) {
  try {
    const manifest = buildPublicBetaPacket("package:public-beta");
    console.log(JSON.stringify(manifest, null, 2));
    if (manifest.status !== "ready_for_public_beta") {
      process.exitCode = 1;
    }
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }
}

