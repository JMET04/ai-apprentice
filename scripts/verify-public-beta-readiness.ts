import fs from "node:fs";
import path from "node:path";

type PublicBetaCheck = {
  name: string;
  pass: boolean;
  evidence: string;
};

const artifactsDir = path.join(process.cwd(), "artifacts", "productization");
const packetDir = path.join(artifactsDir, "public-beta-packet");
const productTrialPacketDir = path.join(artifactsDir, "product-trial-packet");
const manifestPath = path.join(packetDir, "public-beta-manifest.json");
const receiptPath = path.join(artifactsDir, "public-beta-readiness.json");

function push(checks: PublicBetaCheck[], name: string, pass: boolean, evidence: string) {
  checks.push({ name, pass, evidence });
}

function readJson<T>(relativePath: string): T | null {
  try {
    return JSON.parse(fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")) as T;
  } catch {
    return null;
  }
}

function fileExistsWithSize(relativePath: string, minimumBytes = 1) {
  const fullPath = path.join(process.cwd(), relativePath);
  return fs.existsSync(fullPath) && fs.statSync(fullPath).size >= minimumBytes;
}

function packetFileExists(destination: string, minimumBytes = 1) {
  const fullPath = path.join(packetDir, destination);
  return fs.existsSync(fullPath) && fs.statSync(fullPath).size >= minimumBytes;
}

const coreHandoffDocs = [
  { source: "README.md", destination: "docs/README.md" },
  { source: "PRODUCT_HANDOFF.md", destination: "docs/PRODUCT_HANDOFF.md" },
  { source: "PRODUCTIZATION_FOCUS.md", destination: "docs/PRODUCTIZATION_FOCUS.md" }
];

function packetTextMatchesRoot(source: string, destination: string) {
  const sourcePath = path.join(process.cwd(), source);
  const destinationPath = path.join(packetDir, destination);

  return (
    fs.existsSync(sourcePath) &&
    fs.existsSync(destinationPath) &&
    fs.readFileSync(sourcePath, "utf8") === fs.readFileSync(destinationPath, "utf8")
  );
}

function coreHandoffDocSyncEvidence() {
  return coreHandoffDocs
    .map((doc) => `${doc.destination}=${packetTextMatchesRoot(doc.source, doc.destination) ? "current" : "stale_or_missing"}`)
    .join("; ");
}

function coreHandoffDocsMatchRoot() {
  return coreHandoffDocs.every((doc) => packetTextMatchesRoot(doc.source, doc.destination));
}

function firstRealTesterSendHandoffOrderIsCurrent(text: string) {
  const sendBundleIndex = text.indexOf("artifacts/productization/first-real-tester-send-bundle.md");
  const contactReadinessIndex = text.indexOf("artifacts/productization/first-real-tester-contact-readiness.md");
  const executionBriefIndex = text.indexOf("artifacts/productization/first-real-tester-send-execution-brief.md");
  const receiptIndex = text.indexOf("artifacts/productization/first-real-tester-send-receipt-template.md");
  const finalGoNoGoIndex = text.indexOf("artifacts/productization/first-real-tester-final-go-no-go.md");
  const workbenchIndex = text.indexOf("artifacts/productization/first-real-tester-return-workbench.md");

  return (
    sendBundleIndex >= 0 &&
    contactReadinessIndex > sendBundleIndex &&
    executionBriefIndex > contactReadinessIndex &&
    receiptIndex > executionBriefIndex &&
    finalGoNoGoIndex > receiptIndex &&
    workbenchIndex > finalGoNoGoIndex
  );
}
function readPacketText(destination: string) {
  const fullPath = path.join(packetDir, destination);
  return fs.existsSync(fullPath) ? fs.readFileSync(fullPath, "utf8") : "";
}

function readmeDocumentsPostPackageDeliveryIndex() {
  const readme = readPacketText("docs/README.md");
  return (
    readme.includes("post-package outer delivery index") &&
    readme.includes("after `npm run verify:github-source` passes") &&
    readme.includes("rebuild it after every refreshed source zip")
  );
}
function timestampMs(value: string | undefined) {
  const parsed = Date.parse(value ?? "");
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function isAtOrAfterTimestamp(later: string | undefined, earlier: string | undefined) {
  const laterMs = timestampMs(later);
  const earlierMs = timestampMs(earlier);
  return Number.isFinite(laterMs) && Number.isFinite(earlierMs) && laterMs >= earlierMs;
}
function updateManifestIncludedFileBytes(manifestFile: string, destination: string, bytes: number) {
  if (!fs.existsSync(manifestFile)) {
    return;
  }

  const manifest = JSON.parse(fs.readFileSync(manifestFile, "utf8")) as {
    includedFiles?: Array<{ source?: string; destination?: string; required?: boolean; bytes?: number }>;
  };
  const entry = manifest.includedFiles?.find((file) => file.destination === destination);

  if (entry) {
    entry.bytes = bytes;
  }

  fs.writeFileSync(manifestFile, JSON.stringify(manifest, null, 2));
}

function upsertManifestIncludedFile(
  manifestFile: string,
  destination: string,
  source: string,
  required: boolean,
  bytes: number
) {
  if (!fs.existsSync(manifestFile)) {
    return;
  }

  const manifest = JSON.parse(fs.readFileSync(manifestFile, "utf8")) as {
    includedFiles?: Array<{ source?: string; destination?: string; required?: boolean; bytes?: number }>;
  };
  manifest.includedFiles = manifest.includedFiles ?? [];
  const entry = manifest.includedFiles.find((file) => file.destination === destination);

  if (entry) {
    entry.source = source;
    entry.required = required;
    entry.bytes = bytes;
  } else {
    manifest.includedFiles.push({ source, destination, required, bytes });
  }

  fs.writeFileSync(manifestFile, JSON.stringify(manifest, null, 2));
}

function syncEmbeddedProductTrialManifest() {
  const sourceManifest = path.join(productTrialPacketDir, "product-trial-manifest.json");
  const destinationManifest = path.join(packetDir, "evidence", "product-trial-manifest.json");

  if (!fs.existsSync(sourceManifest) || !fs.existsSync(destinationManifest)) {
    return;
  }

  fs.copyFileSync(sourceManifest, destinationManifest);
  updateManifestIncludedFileBytes(
    manifestPath,
    "evidence/product-trial-manifest.json",
    fs.statSync(destinationManifest).size
  );
}

function syncEmbeddedProductTrialVerification() {
  const sourceReceipt = path.join(productTrialPacketDir, "evidence", "product-trial-packet-verification.json");
  const destinationReceipt = path.join(packetDir, "evidence", "product-trial-packet-verification.json");

  if (!fs.existsSync(sourceReceipt)) {
    return;
  }

  fs.mkdirSync(path.dirname(destinationReceipt), { recursive: true });
  fs.copyFileSync(sourceReceipt, destinationReceipt);
  upsertManifestIncludedFile(
    manifestPath,
    "evidence/product-trial-packet-verification.json",
    "artifacts/productization/product-trial-packet/evidence/product-trial-packet-verification.json",
    true,
    fs.statSync(destinationReceipt).size
  );
}
function syncReadinessEvidenceIntoPacket(packetRoot: string, manifestFile: string, receiptJson: string) {
  const packetReceiptPath = path.join(packetRoot, "evidence", "public-beta-readiness.json");

  fs.mkdirSync(path.dirname(packetReceiptPath), { recursive: true });
  fs.writeFileSync(packetReceiptPath, receiptJson);

  if (!fs.existsSync(manifestFile)) {
    return;
  }

  const manifest = JSON.parse(fs.readFileSync(manifestFile, "utf8")) as {
    includedFiles?: Array<{ source?: string; destination?: string; required?: boolean; bytes?: number }>;
  };
  const receiptEntry = manifest.includedFiles?.find(
    (file) => file.destination === "evidence/public-beta-readiness.json"
  );

  if (receiptEntry) {
    receiptEntry.bytes = fs.statSync(packetReceiptPath).size;
  }

  fs.writeFileSync(manifestFile, JSON.stringify(manifest, null, 2));
}

function syncPacketReadinessEvidence(receiptJson: string) {
  syncReadinessEvidenceIntoPacket(packetDir, manifestPath, receiptJson);
  syncReadinessEvidenceIntoPacket(
    productTrialPacketDir,
    path.join(productTrialPacketDir, "product-trial-manifest.json"),
    receiptJson
  );
  syncEmbeddedProductTrialManifest();
  syncEmbeddedProductTrialVerification();
}
function main() {
  syncEmbeddedProductTrialManifest();
  syncEmbeddedProductTrialVerification();
  const checks: PublicBetaCheck[] = [];
  const manifest = fs.existsSync(manifestPath)
    ? (JSON.parse(fs.readFileSync(manifestPath, "utf8")) as {
        responseMode?: string;
        status?: string;
        betaCanStart?: boolean;
        requiredPassed?: number;
        requiredTotal?: number;
        releaseDecision?: string;
        productScope?: string;
        allSoftwareObjective?: string;
        packagingBoundary?: { accepted?: boolean; packagingGated?: boolean; status?: string };
        readinessChecks?: Array<{ name?: string; pass?: boolean; requiredForBeta?: boolean }>;
        includedFiles?: Array<{ source?: string; destination?: string; required?: boolean; bytes?: number }>;
        generatedFiles?: Array<{ source?: string; destination?: string; role?: string; required?: boolean; bytes?: number }>;
        entrypoints?: {
          publicBeta?: string;
          startHere?: string;
          testerRunbook?: string;
          feedbackMarkdownTemplate?: string;
          feedbackReceiptTemplate?: string;
          testerInvite?: string;
          publicBetaSessionPlan?: string;
          publicBetaSessionReceiptTemplate?: string;
          humanAcceptanceReviewerKit?: string;
          humanAcceptanceReviewerInvite?: string;
          humanAcceptanceReceiptTemplate?: string;
          productTakeoverDecisionMatrix?: string;
          productizationLaunchChecklist?: string;
          productStatusSummary?: string;
          productOperatorBrief?: string;
          productReleaseBlockerBoard?: string;
          productReleaseApprovalTemplate?: string;
          realModelTrialKit?: string;
          realModelTrialReceiptTemplate?: string;
        };
        testerLaunchGate?: {
          requiredImmediatelyBeforeContact?: boolean;
          command?: string;
          evidencePath?: string;
          startHereSection?: string;
          stopIf?: string;
        };
        betaCollectionTargets?: string[];
      })
    : null;
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
  const handoffBrowserSmoke = readJson<{
    responseMode?: string;
    status?: string;
    releaseDecision?: string;
    accepted?: boolean;
    packagingGated?: boolean;
    passed?: number;
    total?: number;
    captures?: Array<{ viewport?: string; pass?: boolean }>;
  }>("artifacts/productization/handoff-browser-smoke.json");
  const publicBetaBrowserSmoke = readJson<{
    responseMode?: string;
    status?: string;
    releaseDecision?: string;
    reviewOnly?: boolean;
    accepted?: boolean;
    packagingGated?: boolean;
    passed?: number;
    total?: number;
    captures?: Array<{ viewport?: string; screenshotBytes?: number; missingTexts?: string[] }>;
    validation?: { dryRunValidated?: boolean; noInboxGrowth?: boolean };
  }>("artifacts/productization/public-beta-browser-smoke.json");  const manualBrowserSmoke = readJson<{
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
    captures?: Array<{ viewport?: string; screenshotBytes?: number; pass?: boolean }>;
  }>("artifacts/productization/manual-acceptance-browser-smoke.json");
  const releaseReadiness = readJson<{
    status?: string;
    releaseDecision?: string;
    blockers?: Array<{ name?: string }>;
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
    generatedAt?: string;
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
    nextBestActions?: Array<{ id?: string; allowed?: boolean }>;
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
    lanes?: Array<{ id?: string; allowed?: boolean; evidencePath?: string; redactionChecklistPath?: string; stopCondition?: string }>;
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
    blockedActions?: Array<{ id?: string; blocked?: boolean }>;
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
  const productReleaseApprovalReturnIntakeVerification = readJson<{
    responseMode?: string;
    status?: string;
    releaseDecision?: string;
    accepted?: boolean;
    packagingGated?: boolean;
    canRelease?: boolean;
    passed?: number;
    total?: number;
  }>("artifacts/productization/product-release-approval-return-intake-verification.json");
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
  const realModelTrialReturnIntakeVerification = readJson<{
    responseMode?: string;
    status?: string;
    releaseDecision?: string;
    accepted?: boolean;
    packagingGated?: boolean;
    canActivateRealModel?: boolean;
    canRelease?: boolean;
    passed?: number;
    total?: number;
  }>("artifacts/productization/real-model-trial-return-intake-verification.json");
  const productUiApiSmoke = readJson<{
    responseMode?: string;
    status?: string;
    passed?: number;
    total?: number;
    releaseDecision?: string;
    accepted?: boolean;
    packagingGated?: boolean;
  }>("artifacts/productization/product-ui-api-smoke.json");
  const feedbackReceiptTemplate = readJson<{
    responseMode?: string;
    releaseDecision?: string;
    betaDecisionAllowedValues?: string[];
    defaultBetaDecision?: string;
    reviewOnly?: boolean;
    accepted?: boolean;
    packagingGated?: boolean;
    locks?: {
      mustNotSaveAcceptance?: boolean;
      mustNotUnlockPackaging?: boolean;
      mustNotClaimReleaseReady?: boolean;
      mustNotResumeAllSoftwareObjective?: boolean;
    };
  }>("artifacts/productization/public-beta-packet/docs/PUBLIC_BETA_FEEDBACK_RECEIPT.template.json");
  const feedbackCollectionVerification = readJson<{
    responseMode?: string;
    status?: string;
    passed?: number;
    total?: number;
    releaseDecision?: string;
    accepted?: boolean;
    packagingGated?: boolean;
  }>("artifacts/productization/public-beta-feedback-collection-verification.json");
  const feedbackCollection = readJson<{
    responseMode?: string;
    status?: string;
    nextAction?: string;
    releaseDecision?: string;
    accepted?: boolean;
    packagingGated?: boolean;
  }>("artifacts/productization/public-beta-feedback-collection.json");
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
    passed?: number;
    total?: number;
    releaseDecision?: string;
    accepted?: boolean;
    packagingGated?: boolean;
    canRelease?: boolean;
  }>("artifacts/productization/human-acceptance-receipt-validation.json");
  const humanAcceptanceReturnIntakeVerification = readJson<{
    responseMode?: string;
    status?: string;
    releaseDecision?: string;
    accepted?: boolean;
    packagingGated?: boolean;
    canRelease?: boolean;
    passed?: number;
    total?: number;
  }>("artifacts/productization/human-acceptance-return-intake-verification.json");
  const followUpPlan = readJson<{
    responseMode?: string;
    status?: string;
    canInviteNextTester?: boolean;
    releaseDecision?: string;
    accepted?: boolean;
    packagingGated?: boolean;
    actions?: unknown[];
    locks?: {
      mustNotSaveAcceptance?: boolean;
      mustNotUnlockPackaging?: boolean;
      mustNotClaimReleaseReady?: boolean;
      mustNotResumeAllSoftwareObjective?: boolean;
    };
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
    failedReasons?: string[];
    releaseDecision?: string;
    accepted?: boolean;
    packagingGated?: boolean;
    testerChecklist?: unknown[];
    maintainerChecklist?: string[];
    launchPreflight?: {
      requiredImmediatelyBeforeContact?: boolean;
      command?: string;
      evidencePath?: string;
      mustBeGeneratedAfterInvite?: boolean;
      mustBeGeneratedAfterProductizationFreshness?: boolean;
      stopIf?: string;
    };
    expectedReturnedEvidence?: string[];
    locks?: {
      mustNotSaveAcceptance?: boolean;
      mustNotUnlockPackaging?: boolean;
      mustNotClaimReleaseReady?: boolean;
      mustNotResumeAllSoftwareObjective?: boolean;
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
  const publicBetaSessionPlan = readJson<{
    responseMode?: string;
    status?: string;
    canStartSession?: boolean;
    failedReasons?: string[];
    releaseDecision?: string;
    reviewOnly?: boolean;
    accepted?: boolean;
    packagingGated?: boolean;
    sessionPhases?: unknown[];
    returnPipeline?: string[];
    receiptBindingRule?: string;
    launchPreflight?: { requiredImmediatelyBeforeContact?: boolean; command?: string; evidencePath?: string };
    locks?: {
      mustNotSaveAcceptance?: boolean;
      mustNotUnlockPackaging?: boolean;
      mustNotClaimReleaseReady?: boolean;
      mustNotResumeAllSoftwareObjective?: boolean;
      mustNotActivateRealModel?: boolean;
    };
  }>("artifacts/productization/public-beta-session-plan.json");
  const publicBetaSessionPlanVerification = readJson<{
    responseMode?: string;
    status?: string;
    passed?: number;
    total?: number;
    releaseDecision?: string;
    accepted?: boolean;
    packagingGated?: boolean;
  }>("artifacts/productization/public-beta-session-plan-verification.json");
  const publicBetaSessionReceiptValidation = readJson<{
    responseMode?: string;
    status?: string;
    mode?: string;
    releaseDecision?: string;
    reviewOnly?: boolean;
    accepted?: boolean;
    packagingGated?: boolean;
    canRelease?: boolean;
    passed?: number;
    total?: number;
  }>("artifacts/productization/public-beta-session-receipt-validation.json");
  const testerSessionPreflight = readJson<{
    responseMode?: string;
    status?: string;
    canInviteTester?: boolean;
    generatedAt?: string;
    passed?: number;
    total?: number;
    releaseDecision?: string;
    accepted?: boolean;
    packagingGated?: boolean;
  }>("artifacts/productization/public-beta-tester-session-preflight.json");
  const returnIntakeVerification = readJson<{
    responseMode?: string;
    status?: string;
    passed?: number;
    total?: number;
    releaseDecision?: string;
    accepted?: boolean;
    packagingGated?: boolean;
  }>("artifacts/productization/public-beta-return-intake-verification.json");
  const packetPreparationReceipt = readJson<{
    responseMode?: string;
    status?: string;
    passed?: number;
    total?: number;
    releaseDecision?: string;
    accepted?: boolean;
    packagingGated?: boolean;
    steps?: Array<{ status?: string; outputTail?: string; outputSummary?: string }>;
  }>("artifacts/productization/public-beta-packet/evidence/public-beta-preparation.json");
  const productTrialManifest = readJson<{
    responseMode?: string;
    status?: string;
    generatedAt?: string;
    allSoftwareObjective?: string;
    packagingBoundary?: { accepted?: boolean; packagingGated?: boolean; status?: string };
    includedFiles?: Array<{ destination?: string; required?: boolean; bytes?: number }>;
  }>("artifacts/productization/public-beta-packet/evidence/product-trial-manifest.json");
  const productTrialVerification = readJson<{
    responseMode?: string;
    status?: string;
    generatedAt?: string;
    command?: string;
    packetDir?: string;
    releaseDecision?: string;
    allSoftwareObjective?: string;
    reviewOnly?: boolean;
    accepted?: boolean;
    packagingGated?: boolean;
    canRelease?: boolean;
    passed?: number;
    total?: number;
    embeddedInPacket?: boolean;
  }>("artifacts/productization/public-beta-packet/evidence/product-trial-packet-verification.json");
  const takeoverEntryConsistency = readJson<{
    responseMode?: string;
    status?: string;
    releaseDecision?: string;
    allSoftwareObjective?: string;
    accepted?: boolean;
    packagingGated?: boolean;
    canRelease?: boolean;
    passed?: number;
    total?: number;
  }>("artifacts/productization/public-beta-packet/evidence/product-takeover-entry-consistency.json");
  const packageJson = readJson<{ scripts?: Record<string, string> }>("package.json");

  const includedDestinations = new Set((manifest?.includedFiles ?? []).map((file) => file.destination));
  const generatedFiles = manifest?.generatedFiles ?? [];
  const generatedDestinations = new Set(generatedFiles.map((file) => file.destination));
  const requiredDestinations = [
    "docs/README.md",
    "docs/PRODUCT_HANDOFF.md",
    "docs/PRODUCTIZATION_FOCUS.md",
    "docs/.env.example",
    "evidence/product-verification-receipt.json",
    "evidence/product-ui-api-smoke.json",
    "evidence/product-runtime-verification.json",
    "evidence/product-runtime-doctor.json",
    "evidence/product-release-readiness.json",
    "evidence/productization-evidence-freshness.json",
    "evidence/product-status-summary.json",
    "evidence/product-status-summary-verification.json",
    "docs/PRODUCT_STATUS_SUMMARY.md",
    "evidence/product-operator-brief.json",
    "evidence/product-operator-brief-verification.json",
    "docs/PRODUCT_OPERATOR_BRIEF.md",
    "evidence/product-takeover-decision-matrix.json",
    "evidence/product-takeover-decision-matrix-verification.json",
    "docs/PRODUCT_TAKEOVER_DECISION_MATRIX.md",
    "evidence/product-takeover-entry-consistency.json",
    "evidence/product-release-blocker-board.json",
    "evidence/product-release-blocker-board-verification.json",
    "docs/PRODUCT_RELEASE_BLOCKER_BOARD.md",
    "docs/PRODUCT_RELEASE_APPROVAL.template.json",
    "docs/PRODUCT_RELEASE_APPROVAL_TEMPLATE.md",
    "evidence/product-release-approval-validation.json",
    "evidence/product-release-approval-return-intake-verification.json",
    "evidence/real-model-trial-kit.json",
    "evidence/real-model-adapter-contract-verification.json",
    "evidence/real-model-trial-kit-verification.json",
    "docs/REAL_MODEL_TRIAL_KIT.md",
    "docs/REAL_MODEL_TRIAL_RECEIPT.template.json",
    "docs/REAL_MODEL_TRIAL_RECEIPT_TEMPLATE.md",
    "evidence/real-model-trial-receipt-validation.json",
    "evidence/real-model-trial-return-intake-verification.json",
    "evidence/product-handoff-readiness.json",
    "evidence/human-acceptance-gate.json",
    "evidence/human-acceptance-session-preflight.json",
    "evidence/human-acceptance-reviewer-kit.json",
    "evidence/human-acceptance-reviewer-kit-verification.json",
    "docs/HUMAN_ACCEPTANCE_REVIEWER_KIT.md",
    "evidence/human-acceptance-reviewer-invite.json",
    "evidence/human-acceptance-reviewer-invite-verification.json",
    "docs/HUMAN_ACCEPTANCE_REVIEWER_INVITE.md",
    "docs/HUMAN_ACCEPTANCE_RECEIPT.template.json",
    "docs/HUMAN_ACCEPTANCE_RECEIPT_TEMPLATE.md",
    "evidence/human-acceptance-receipt-validation.json",
    "evidence/human-acceptance-return-intake-verification.json",
    "evidence/manual-acceptance-classification-verification.json",
    "evidence/manual-acceptance-latest.json",
    "evidence/runtime-artifact-cleanup.json",
    "evidence/live-product-handoff.json",
    "evidence/public-beta-feedback-api-verification.json",
    "evidence/public-beta-feedback-collection-verification.json",
    "evidence/public-beta-follow-up-plan.json",
    "evidence/public-beta-follow-up-plan-verification.json",
    "evidence/public-beta-tester-invite.json",
    "evidence/public-beta-tester-invite-verification.json",
    "evidence/public-beta-return-intake-verification.json",
    "docs/PUBLIC_BETA_TESTER_INVITE.md",
    "docs/PUBLIC_BETA_SESSION_PLAN.md",
    "docs/PUBLIC_BETA_SESSION_RECEIPT.template.json",
    "docs/PUBLIC_BETA_SESSION_RECEIPT_TEMPLATE.md",
    "evidence/manual-acceptance-browser-smoke.json",
    "evidence/manual-acceptance-report.browser-smoke.json",
    "evidence/product-trial-manifest.json",
    "evidence/product-trial-packet-verification.json"
  ];
  const missingRequiredDestinations = requiredDestinations.filter(
    (destination) => !includedDestinations.has(destination) || !packetFileExists(destination, 100)
  );
  const requiredReadiness = (manifest?.readinessChecks ?? []).filter((check) => check.requiredForBeta);
  const failedRequiredReadiness = requiredReadiness.filter((check) => check.pass !== true);
  const requiredGeneratedFiles = [
    {
      destination: "START_PUBLIC_BETA.md",
      role: "tester_entrypoint",
      entrypoint: "artifacts/productization/public-beta-packet/START_PUBLIC_BETA.md"
    },
    {
      destination: "docs/PUBLIC_BETA_TESTER_RUNBOOK.md",
      role: "tester_runbook",
      entrypoint: "artifacts/productization/public-beta-packet/docs/PUBLIC_BETA_TESTER_RUNBOOK.md"
    },
    {
      destination: "docs/PUBLIC_BETA_FEEDBACK_TEMPLATE.md",
      role: "human_readable_feedback_template",
      entrypoint: "artifacts/productization/public-beta-packet/docs/PUBLIC_BETA_FEEDBACK_TEMPLATE.md"
    },
    {
      destination: "docs/PUBLIC_BETA_FEEDBACK_RECEIPT.template.json",
      role: "machine_readable_feedback_receipt_template",
      entrypoint: "artifacts/productization/public-beta-packet/docs/PUBLIC_BETA_FEEDBACK_RECEIPT.template.json"
    }
  ];
  const missingGeneratedFiles = requiredGeneratedFiles.filter((required) => {
    const declared = generatedFiles.find((file) => file.destination === required.destination);

    return (
      !generatedDestinations.has(required.destination) ||
      declared?.role !== required.role ||
      declared.required !== true ||
      Number(declared.bytes ?? 0) < 100 ||
      !packetFileExists(required.destination, 100)
    );
  });
  const startHerePath = path.join(packetDir, "START_PUBLIC_BETA.md");
  const startHereText = fs.existsSync(startHerePath) ? fs.readFileSync(startHerePath, "utf8") : "";

  const productHandoffPath = path.join(packetDir, "docs", "PRODUCT_HANDOFF.md");
  const productHandoffText = fs.existsSync(productHandoffPath) ? fs.readFileSync(productHandoffPath, "utf8") : "";
  const testerRunbookText = readPacketText("docs/PUBLIC_BETA_TESTER_RUNBOOK.md");
  const testerInviteText = readPacketText("docs/PUBLIC_BETA_TESTER_INVITE.md");

  const packetTakeoverMatrixText = readPacketText("docs/PRODUCT_TAKEOVER_DECISION_MATRIX.md");
  const packetLaunchChecklistText = readPacketText("docs/PRODUCTIZATION_LAUNCH_CHECKLIST.md");


  push(
    checks,
    "Public beta manifest is ready",
    manifest?.responseMode === "public_beta_packet_manifest_json_v1" &&
      manifest.status === "ready_for_public_beta" &&
      manifest.betaCanStart === true &&
      manifest.requiredPassed === manifest.requiredTotal &&
      Number(manifest.requiredTotal ?? 0) >= 8,
    `status=${manifest?.status ?? "missing"}; betaCanStart=${manifest?.betaCanStart ?? "missing"}; required=${
      manifest?.requiredPassed ?? "?"
    }/${manifest?.requiredTotal ?? "?"}`
  );

  push(
    checks,
    "Public beta remains bounded and not release",
    manifest?.productScope === "bounded_core_teaching_loop" &&
      manifest.allSoftwareObjective === "paused" &&
      manifest.releaseDecision === "do_not_release" &&
      manifest.packagingBoundary?.accepted === false &&
      manifest.packagingBoundary.packagingGated === true,
    `scope=${manifest?.productScope ?? "missing"}; allSoftware=${manifest?.allSoftwareObjective ?? "missing"}; release=${
      manifest?.releaseDecision ?? "missing"
    }; accepted=${manifest?.packagingBoundary?.accepted ?? "missing"}; packagingGated=${
      manifest?.packagingBoundary?.packagingGated ?? "missing"
    }`
  );

  push(
    checks,
    "Required beta checks are green",
    requiredReadiness.length >= 8 && failedRequiredReadiness.length === 0,
    `requiredChecks=${requiredReadiness.length}; failed=${failedRequiredReadiness
      .map((check) => check.name ?? "unnamed")
      .join(",") || "none"}`
  );

  push(
    checks,
    "Required beta packet files exist",
    missingRequiredDestinations.length === 0,
    `missing=${missingRequiredDestinations.join(",") || "none"}; files=${manifest?.includedFiles?.length ?? 0}`
  );

  push(
    checks,
    "Core beta handoff docs match root docs",
    coreHandoffDocsMatchRoot(),
    coreHandoffDocSyncEvidence()
  );

  
  push(
    checks,
    "Public beta README documents post-package delivery index boundary",
    readmeDocumentsPostPackageDeliveryIndex(),
    `postPackage=${readPacketText("docs/README.md").includes("post-package outer delivery index")}; afterVerify=${readPacketText(
      "docs/README.md"
    ).includes("after `npm run verify:github-source` passes")}; rebuild=${readPacketText("docs/README.md").includes(
      "rebuild it after every refreshed source zip"
    )}`
  );
push(
    checks,
    "Product trial packet verification is packaged and current",
    productTrialManifest?.responseMode === "product_trial_packet_manifest_json_v1" &&
      productTrialManifest.status === "built" &&
      productTrialManifest.allSoftwareObjective === "paused" &&
      productTrialManifest.packagingBoundary?.accepted === false &&
      productTrialManifest.packagingBoundary.packagingGated === true &&
      productTrialVerification?.responseMode === "product_trial_packet_verification_json_v1" &&
      productTrialVerification.status === "passed" &&
      productTrialVerification.command === "npm run verify:product-trial" &&
      productTrialVerification.packetDir === "artifacts/productization/product-trial-packet" &&
      productTrialVerification.releaseDecision === "do_not_release" &&
      productTrialVerification.allSoftwareObjective === "paused" &&
      productTrialVerification.reviewOnly === true &&
      productTrialVerification.accepted === false &&
      productTrialVerification.packagingGated === true &&
      productTrialVerification.canRelease === false &&
      productTrialVerification.embeddedInPacket === true &&
      productTrialVerification.passed === productTrialVerification.total &&
      Number(productTrialVerification.total ?? 0) >= 14 &&
      isAtOrAfterTimestamp(productTrialVerification.generatedAt, productTrialManifest.generatedAt) &&
      includedDestinations.has("evidence/product-trial-manifest.json") &&
      includedDestinations.has("evidence/product-trial-packet-verification.json") &&
      packetFileExists("evidence/product-trial-manifest.json", 1000) &&
      packetFileExists("evidence/product-trial-packet-verification.json", 1000),
    `manifest=${productTrialManifest?.status ?? "missing"}; verification=${
      productTrialVerification?.status ?? "missing"
    }; checks=${productTrialVerification?.passed ?? "?"}/${productTrialVerification?.total ?? "?"}; current=${isAtOrAfterTimestamp(
      productTrialVerification?.generatedAt,
      productTrialManifest?.generatedAt
    )}; packaged=${packetFileExists("evidence/product-trial-packet-verification.json", 1000)}`
  );

  push(
    checks,
    "Product UI/API smoke evidence is packaged and green",
    productUiApiSmoke?.responseMode === "product_ui_api_smoke_receipt_json_v1" &&
      productUiApiSmoke.status === "passed" &&
      productUiApiSmoke.passed === productUiApiSmoke.total &&
      Number(productUiApiSmoke.total ?? 0) > 0 &&
      productUiApiSmoke.releaseDecision === "do_not_release" &&
      productUiApiSmoke.accepted === false &&
      productUiApiSmoke.packagingGated === true &&
      includedDestinations.has("evidence/product-ui-api-smoke.json") &&
      packetFileExists("evidence/product-ui-api-smoke.json", 100),
    `status=${productUiApiSmoke?.status ?? "missing"}; checks=${productUiApiSmoke?.passed ?? "?"}/${
      productUiApiSmoke?.total ?? "?"
    }; packaged=${packetFileExists("evidence/product-ui-api-smoke.json", 100)}`
  );

  push(
    checks,
    "Public beta packet embeds current first-real tester send handoff order",
    firstRealTesterSendHandoffOrderIsCurrent(packetTakeoverMatrixText),
    `sendOrderCurrent=${firstRealTesterSendHandoffOrderIsCurrent(packetTakeoverMatrixText)}; contact=${packetTakeoverMatrixText.includes("first-real-tester-contact-readiness.md")}; execution=${packetTakeoverMatrixText.includes("first-real-tester-send-execution-brief.md")}; finalGoNoGo=${packetTakeoverMatrixText.includes("first-real-tester-final-go-no-go.md")}`
  );
  push(
    checks,
    "Public beta instructions and feedback template exist",
    fileExistsWithSize("artifacts/productization/public-beta-packet/START_PUBLIC_BETA.md", 100) &&
      startHereText.includes("http://127.0.0.1:3000/public-beta") &&
      startHereText.includes("npm run build:product-operator-brief") &&
      startHereText.includes("npm run verify:product-operator-brief") &&
      startHereText.includes("npm run verify:productization-evidence-freshness") &&
      startHereText.includes("npm run build:product-takeover-matrix") &&
      startHereText.includes("npm run verify:product-takeover-matrix") &&
      startHereText.includes("npm run build:productization-launch-checklist") &&
      startHereText.includes("npm run verify:productization-launch-checklist") &&
      startHereText.includes("npm run package:public-beta") &&
      startHereText.includes("ensures the product trial packet has") &&
      startHereText.includes("Use `npm run verify:product-trial` only") &&
      startHereText.includes("npm run verify:public-beta") &&
      startHereText.includes("evidence/productization-evidence-freshness.json") &&
      startHereText.includes("evidence/product-trial-manifest.json") &&
      startHereText.includes("evidence/product-trial-packet-verification.json") &&
      startHereText.includes("evidence/product-operator-brief.json") &&
      startHereText.includes("evidence/product-operator-brief-verification.json") &&
      startHereText.includes("docs/PRODUCT_OPERATOR_BRIEF.md") &&
      startHereText.includes("docs/PRODUCT_TAKEOVER_DECISION_MATRIX.md") &&
      startHereText.includes("docs/PRODUCTIZATION_LAUNCH_CHECKLIST.md") &&
      startHereText.includes("evidence/productization-launch-checklist.json") &&
      startHereText.includes("evidence/productization-launch-checklist-verification.json") &&
      startHereText.includes("evidence/product-takeover-decision-matrix.json") &&
      startHereText.includes("evidence/product-takeover-decision-matrix-verification.json") &&
      packetFileExists("docs/PUBLIC_BETA_TESTER_RUNBOOK.md", 1000) &&
      testerRunbookText.includes("Facilitator-filled whole-session receipt JSON from `docs/PUBLIC_BETA_SESSION_RECEIPT.template.json`") &&
      testerRunbookText.includes("facilitator/maintainer fills the whole-session receipt") &&
      packetFileExists("docs/PUBLIC_BETA_FEEDBACK_TEMPLATE.md", 100) &&
      packetFileExists("docs/PUBLIC_BETA_FEEDBACK_RECEIPT.template.json", 100) &&
      packetFileExists("docs/PUBLIC_BETA_TESTER_INVITE.md", 500) &&
      testerInviteText.includes("Send the tester") &&
      testerInviteText.includes("PUBLIC_BETA_FEEDBACK_RECEIPT.template.json") &&
      testerInviteText.includes("keep docs/PUBLIC_BETA_SESSION_RECEIPT.template.json with the facilitator/maintainer") &&
      !testerInviteText.includes("return both JSON receipts") &&
      packetFileExists("docs/HUMAN_ACCEPTANCE_REVIEWER_KIT.md", 1000) &&
      packetFileExists("docs/HUMAN_ACCEPTANCE_REVIEWER_INVITE.md", 1000) &&
      packetFileExists("docs/HUMAN_ACCEPTANCE_RECEIPT.template.json", 100) &&
      packetFileExists("docs/HUMAN_ACCEPTANCE_RECEIPT_TEMPLATE.md", 500) &&
      packetFileExists("docs/PRODUCT_OPERATOR_BRIEF.md", 1000) && packetFileExists("docs/PRODUCT_TAKEOVER_DECISION_MATRIX.md", 1000) && packetFileExists("docs/PRODUCTIZATION_LAUNCH_CHECKLIST.md", 1000) && packetFileExists("evidence/productization-launch-checklist.json", 100) && packetFileExists("evidence/productization-launch-checklist-verification.json", 100) && packetFileExists("evidence/product-takeover-decision-matrix.json", 100) && packetFileExists("evidence/product-takeover-decision-matrix-verification.json", 100) &&
      packetFileExists("docs/PRODUCT_RELEASE_BLOCKER_BOARD.md", 1000) &&
      packetFileExists("docs/PRODUCT_RELEASE_APPROVAL.template.json", 100) &&
      packetFileExists("docs/PRODUCT_RELEASE_APPROVAL_TEMPLATE.md", 500) &&
      packetFileExists("docs/REAL_MODEL_TRIAL_KIT.md", 1000) &&
      packetFileExists("docs/REAL_MODEL_TRIAL_RECEIPT.template.json", 100) &&
      packetFileExists("docs/REAL_MODEL_TRIAL_RECEIPT_TEMPLATE.md", 500),
    `startHere=${fileExistsWithSize("artifacts/productization/public-beta-packet/START_PUBLIC_BETA.md", 100)}; operatorBriefStartHere=${startHereText.includes("docs/PRODUCT_OPERATOR_BRIEF.md")}; productTrialDocs=${startHereText.includes("evidence/product-trial-manifest.json")}/${startHereText.includes("evidence/product-trial-packet-verification.json")}; productTrialAuto=${startHereText.includes("ensures the product trial packet has")}; productTrialAudit=${startHereText.includes("Use `npm run verify:product-trial` only")}; publicBetaVerifier=${startHereText.includes("npm run verify:public-beta")}; feedbackTemplate=${packetFileExists(
      "docs/PUBLIC_BETA_FEEDBACK_TEMPLATE.md",
      100
    )}; testerInviteRoleSplit=${testerInviteText.includes("Send the tester") && testerInviteText.includes("PUBLIC_BETA_FEEDBACK_RECEIPT.template.json") && testerInviteText.includes("keep docs/PUBLIC_BETA_SESSION_RECEIPT.template.json with the facilitator/maintainer") && !testerInviteText.includes("return both JSON receipts")}; testerRunbook=${packetFileExists("docs/PUBLIC_BETA_TESTER_RUNBOOK.md", 1000)}; sessionReceiptFacilitator=${testerRunbookText.includes("Facilitator-filled whole-session receipt JSON from `docs/PUBLIC_BETA_SESSION_RECEIPT.template.json`") && testerRunbookText.includes("facilitator/maintainer fills the whole-session receipt")}; feedbackReceiptTemplate=${packetFileExists("docs/PUBLIC_BETA_FEEDBACK_RECEIPT.template.json", 100)}; testerInvite=${packetFileExists(
      "docs/PUBLIC_BETA_TESTER_INVITE.md",
      500
    )}; reviewerKit=${packetFileExists("docs/HUMAN_ACCEPTANCE_REVIEWER_KIT.md", 1000)}; reviewerInvite=${packetFileExists("docs/HUMAN_ACCEPTANCE_REVIEWER_INVITE.md", 1000)}; humanReceiptTemplate=${packetFileExists(
      "docs/HUMAN_ACCEPTANCE_RECEIPT.template.json",
      100
    )}; operatorBrief=${packetFileExists("docs/PRODUCT_OPERATOR_BRIEF.md", 1000) && packetFileExists("docs/PRODUCT_TAKEOVER_DECISION_MATRIX.md", 1000) && packetFileExists("docs/PRODUCTIZATION_LAUNCH_CHECKLIST.md", 1000) && packetFileExists("evidence/productization-launch-checklist.json", 100) && packetFileExists("evidence/productization-launch-checklist-verification.json", 100) && packetFileExists("evidence/product-takeover-decision-matrix.json", 100) && packetFileExists("evidence/product-takeover-decision-matrix-verification.json", 100)}; releaseApprovalTemplate=${packetFileExists(
      "docs/PRODUCT_RELEASE_APPROVAL.template.json",
      100
    )}; realModelKit=${packetFileExists(
      "docs/REAL_MODEL_TRIAL_KIT.md",
      1000
    )}; realModelReceiptTemplate=${packetFileExists(
      "docs/REAL_MODEL_TRIAL_RECEIPT.template.json",
      100
    )}`
  );

  push(
    checks,
    "Public beta optional return evidence is documented as post-return",
    startHereText.includes("## Optional Evidence Generated After Returns") &&
      startHereText.includes("evidence/public-beta-return-intake.json") &&
      startHereText.includes(
        "appears only after `npm run intake:public-beta-return -- --receipt path/to/submitted-feedback.json --session-receipt path/to/filled-public-beta-session-receipt.json --send-receipt-validation artifacts/productization/first-real-tester-send-receipt-validation.json`"
      ) &&
      startHereText.includes("evidence/human-acceptance-return-intake.json") &&
      startHereText.includes(
        "appears only after `npm run intake:human-acceptance-return -- --receipt path/to/filled-human-acceptance-receipt.json --send-receipt-validation artifacts/productization/first-real-tester-send-receipt-validation.json`"
      ) &&
      startHereText.includes("npm run verify:human-acceptance-return-intake") &&
      startHereText.includes("postIntakeRefresh.commandSequence"),
    `optionalSection=${startHereText.includes("## Optional Evidence Generated After Returns")}; publicReturn=${startHereText.includes(
      "evidence/public-beta-return-intake.json"
    )}; humanReturn=${startHereText.includes("evidence/human-acceptance-return-intake.json")}`
  );

  push(
    checks,
    "Generated beta entry and feedback files are declared",
    missingGeneratedFiles.length === 0 &&
      manifest?.entrypoints?.publicBeta === "http://127.0.0.1:3000/public-beta" &&
      manifest?.entrypoints?.startHere === requiredGeneratedFiles[0].entrypoint &&
      manifest.entrypoints.testerRunbook === requiredGeneratedFiles[1].entrypoint &&
      manifest.entrypoints.feedbackMarkdownTemplate === requiredGeneratedFiles[2].entrypoint &&
      manifest.entrypoints.feedbackReceiptTemplate === requiredGeneratedFiles[3].entrypoint &&
      manifest.entrypoints.testerInvite ===
        "artifacts/productization/public-beta-packet/docs/PUBLIC_BETA_TESTER_INVITE.md" &&
      manifest.entrypoints.publicBetaSessionPlan ===
        "artifacts/productization/public-beta-packet/docs/PUBLIC_BETA_SESSION_PLAN.md" &&
      manifest.entrypoints.publicBetaSessionReceiptTemplate ===
        "artifacts/productization/public-beta-packet/docs/PUBLIC_BETA_SESSION_RECEIPT.template.json" &&
      manifest.entrypoints.humanAcceptanceReviewerKit ===
        "artifacts/productization/public-beta-packet/docs/HUMAN_ACCEPTANCE_REVIEWER_KIT.md" &&
      manifest.entrypoints.humanAcceptanceReviewerInvite ===
        "artifacts/productization/public-beta-packet/docs/HUMAN_ACCEPTANCE_REVIEWER_INVITE.md" &&
      manifest.entrypoints.humanAcceptanceReceiptTemplate ===
        "artifacts/productization/public-beta-packet/docs/HUMAN_ACCEPTANCE_RECEIPT.template.json" &&
      manifest.entrypoints.productTakeoverDecisionMatrix ===
        "artifacts/productization/public-beta-packet/docs/PRODUCT_TAKEOVER_DECISION_MATRIX.md" &&
      manifest.entrypoints.productizationLaunchChecklist ===
        "artifacts/productization/public-beta-packet/docs/PRODUCTIZATION_LAUNCH_CHECKLIST.md" &&
      manifest.entrypoints.productStatusSummary ===
        "artifacts/productization/public-beta-packet/docs/PRODUCT_STATUS_SUMMARY.md" &&
      manifest.entrypoints.productOperatorBrief ===
        "artifacts/productization/public-beta-packet/docs/PRODUCT_OPERATOR_BRIEF.md" &&
      manifest.entrypoints.productReleaseBlockerBoard ===
        "artifacts/productization/public-beta-packet/docs/PRODUCT_RELEASE_BLOCKER_BOARD.md" &&
      manifest.entrypoints.productReleaseApprovalTemplate ===
        "artifacts/productization/public-beta-packet/docs/PRODUCT_RELEASE_APPROVAL.template.json" &&
      manifest.entrypoints.realModelTrialKit ===
        "artifacts/productization/public-beta-packet/docs/REAL_MODEL_TRIAL_KIT.md" &&
      manifest.entrypoints.realModelTrialReceiptTemplate ===
        "artifacts/productization/public-beta-packet/docs/REAL_MODEL_TRIAL_RECEIPT.template.json",
    `missingOrInvalid=${missingGeneratedFiles.map((file) => file.destination).join(",") || "none"}; declared=${
      generatedFiles.length
    }`
  );

  push(
    checks,
    "Public beta feedback receipt template is locked",
    feedbackReceiptTemplate?.responseMode === "public_beta_feedback_receipt_template_json_v1" &&
      feedbackReceiptTemplate.releaseDecision === "do_not_release" &&
      feedbackReceiptTemplate.reviewOnly === true &&
      feedbackReceiptTemplate.accepted === false &&
      feedbackReceiptTemplate.packagingGated === true &&
      feedbackReceiptTemplate.defaultBetaDecision === "needs_fix_before_more_testers" &&
      feedbackReceiptTemplate.betaDecisionAllowedValues?.includes("ready_for_next_beta_tester") === true &&
      feedbackReceiptTemplate.betaDecisionAllowedValues.includes("needs_fix_before_more_testers") &&
      feedbackReceiptTemplate.betaDecisionAllowedValues.includes("blocked") &&
      feedbackReceiptTemplate.locks?.mustNotSaveAcceptance === true &&
      feedbackReceiptTemplate.locks.mustNotUnlockPackaging === true &&
      feedbackReceiptTemplate.locks.mustNotClaimReleaseReady === true &&
      feedbackReceiptTemplate.locks.mustNotResumeAllSoftwareObjective === true,
    `responseMode=${feedbackReceiptTemplate?.responseMode ?? "missing"}; default=${
      feedbackReceiptTemplate?.defaultBetaDecision ?? "missing"
    }; release=${feedbackReceiptTemplate?.releaseDecision ?? "missing"}; accepted=${
      feedbackReceiptTemplate?.accepted ?? "missing"
    }; packagingGated=${feedbackReceiptTemplate?.packagingGated ?? "missing"}`
  );

  push(
    checks,
    "Public beta feedback receipt validator is available",
    packageJson?.scripts?.["verify:public-beta-feedback"] ===
      "tsx scripts/verify-public-beta-feedback-receipt.ts" &&
      packageJson.scripts?.["verify:public-beta-feedback-api"] ===
        "tsx scripts/verify-public-beta-feedback-api.ts" &&
      packageJson.scripts?.["preflight:human-acceptance"] ===
        "tsx scripts/preflight-human-acceptance-session.ts" &&
      packageJson.scripts?.["build:human-acceptance-reviewer-kit"] ===
        "tsx scripts/build-human-acceptance-reviewer-kit.ts" &&
      packageJson.scripts?.["verify:human-acceptance-reviewer-kit"] ===
        "tsx scripts/verify-human-acceptance-reviewer-kit.ts" &&
      packageJson.scripts?.["build:human-acceptance-reviewer-invite"] ===
        "tsx scripts/build-human-acceptance-reviewer-invite.ts" &&
      packageJson.scripts?.["verify:human-acceptance-reviewer-invite"] ===
        "tsx scripts/verify-human-acceptance-reviewer-invite.ts" &&
      packageJson.scripts?.["build:human-acceptance-receipt-template"] ===
        "tsx scripts/build-human-acceptance-receipt-template.ts" &&
      packageJson.scripts?.["verify:human-acceptance-receipt"] ===
        "tsx scripts/verify-human-acceptance-receipt.ts" &&
      packageJson.scripts?.["intake:human-acceptance-return"] ===
        "tsx scripts/intake-human-acceptance-return.ts" &&
      packageJson.scripts?.["verify:human-acceptance-return-intake"] ===
        "tsx scripts/verify-human-acceptance-return-intake.ts" &&
      packageJson.scripts?.["verify:public-beta-feedback-collection"] ===
        "tsx scripts/verify-public-beta-feedback-collection.ts" &&
      packageJson.scripts?.["build:public-beta-session-receipt-template"] ===
        "tsx scripts/build-public-beta-session-receipt-template.ts" &&
      packageJson.scripts?.["verify:public-beta-session-receipt"] ===
        "tsx scripts/verify-public-beta-session-receipt.ts" &&
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
      packageJson.scripts?.["build:product-status-summary"] === "tsx scripts/build-product-status-summary.ts" &&
      packageJson.scripts?.["verify:product-status-summary"] === "tsx scripts/verify-product-status-summary.ts" &&
      packageJson.scripts?.["build:product-takeover-matrix"] ===
        "tsx scripts/build-product-takeover-decision-matrix.ts" &&
      packageJson.scripts?.["verify:product-takeover-matrix"] ===
        "tsx scripts/verify-product-takeover-decision-matrix.ts" &&
      packageJson.scripts?.["verify:productization-evidence-freshness"] ===
        "tsx scripts/verify-productization-evidence-freshness.ts" &&
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
      fileExistsWithSize("scripts/verify-public-beta-feedback-receipt.ts", 100) &&
      fileExistsWithSize("scripts/verify-public-beta-feedback-api.ts", 100) &&
      fileExistsWithSize("scripts/preflight-human-acceptance-session.ts", 100) &&
      fileExistsWithSize("scripts/build-human-acceptance-reviewer-kit.ts", 100) &&
      fileExistsWithSize("scripts/verify-human-acceptance-reviewer-kit.ts", 100) &&
      fileExistsWithSize("scripts/build-human-acceptance-reviewer-invite.ts", 100) &&
      fileExistsWithSize("scripts/verify-human-acceptance-reviewer-invite.ts", 100) &&
      fileExistsWithSize("scripts/build-human-acceptance-receipt-template.ts", 100) &&
      fileExistsWithSize("scripts/verify-human-acceptance-receipt.ts", 100) &&
      fileExistsWithSize("scripts/intake-human-acceptance-return.ts", 100) &&
      fileExistsWithSize("scripts/verify-human-acceptance-return-intake.ts", 100) &&
      fileExistsWithSize("scripts/build-product-status-summary.ts", 100) &&
      fileExistsWithSize("scripts/verify-product-status-summary.ts", 100) &&
      fileExistsWithSize("scripts/build-product-takeover-decision-matrix.ts", 100) &&
      fileExistsWithSize("scripts/verify-product-takeover-decision-matrix.ts", 100) &&
      fileExistsWithSize("scripts/verify-productization-evidence-freshness.ts", 100) &&
      fileExistsWithSize("scripts/build-product-operator-brief.ts", 100) &&
      fileExistsWithSize("scripts/verify-product-operator-brief.ts", 100) &&
      fileExistsWithSize("scripts/build-product-release-blocker-board.ts", 100) &&
      fileExistsWithSize("scripts/verify-product-release-blocker-board.ts", 100) &&
      fileExistsWithSize("scripts/build-product-release-approval-template.ts", 100) &&
      fileExistsWithSize("scripts/verify-product-release-approval.ts", 100) &&
      fileExistsWithSize("scripts/intake-product-release-approval-return.ts", 100) &&
      fileExistsWithSize("scripts/verify-product-release-approval-return-intake.ts", 100) &&
      fileExistsWithSize("scripts/build-real-model-trial-kit.ts", 100) &&
      fileExistsWithSize("scripts/verify-real-model-trial-kit.ts", 100) &&
      fileExistsWithSize("scripts/verify-real-model-adapter-contract.ts", 100) &&
      fileExistsWithSize("scripts/build-real-model-trial-receipt-template.ts", 100) &&
      fileExistsWithSize("scripts/verify-real-model-trial-receipt.ts", 100) &&
      fileExistsWithSize("scripts/intake-real-model-trial-return.ts", 100) &&
      fileExistsWithSize("scripts/verify-real-model-trial-return-intake.ts", 100),
    `script=${packageJson?.scripts?.["verify:public-beta-feedback"] ?? "missing"}; file=${fileExistsWithSize(
      "scripts/verify-public-beta-feedback-receipt.ts",
      100
    )}; apiVerifier=${packageJson?.scripts?.["verify:public-beta-feedback-api"] ?? "missing"}; apiFile=${fileExistsWithSize(
      "scripts/verify-public-beta-feedback-api.ts",
      100
    )}; humanPreflight=${packageJson?.scripts?.["preflight:human-acceptance"] ?? "missing"}; humanPreflightFile=${fileExistsWithSize(
      "scripts/preflight-human-acceptance-session.ts",
      100
    )}; reviewerKit=${packageJson?.scripts?.["build:human-acceptance-reviewer-kit"] ?? "missing"}; reviewerKitVerifier=${
      packageJson?.scripts?.["verify:human-acceptance-reviewer-kit"] ?? "missing"
    }; reviewerInvite=${packageJson?.scripts?.["build:human-acceptance-reviewer-invite"] ?? "missing"}; reviewerInviteVerifier=${
      packageJson?.scripts?.["verify:human-acceptance-reviewer-invite"] ?? "missing"
    }; humanReceiptTemplate=${packageJson?.scripts?.["build:human-acceptance-receipt-template"] ?? "missing"}; humanReceiptVerifier=${
      packageJson?.scripts?.["verify:human-acceptance-receipt"] ?? "missing"
    }; statusSummary=${packageJson?.scripts?.["build:product-status-summary"] ?? "missing"}; statusSummaryVerifier=${packageJson?.scripts?.["verify:product-status-summary"] ?? "missing"}; evidenceFreshness=${packageJson?.scripts?.["verify:productization-evidence-freshness"] ?? "missing"}; operatorBrief=${packageJson?.scripts?.["build:product-operator-brief"] ?? "missing"}; operatorBriefVerifier=${
      packageJson?.scripts?.["verify:product-operator-brief"] ?? "missing"
    }; releaseBlockerBoard=${packageJson?.scripts?.["build:product-release-blocker-board"] ?? "missing"}; releaseBlockerBoardVerifier=${
      packageJson?.scripts?.["verify:product-release-blocker-board"] ?? "missing"
    }; releaseApprovalTemplate=${packageJson?.scripts?.["build:product-release-approval-template"] ?? "missing"}; releaseApprovalVerifier=${
      packageJson?.scripts?.["verify:product-release-approval"] ?? "missing"
    }; collector=${packageJson?.scripts?.["collect:public-beta-feedback"] ?? "missing"}; collectionVerifier=${
      packageJson?.scripts?.["verify:public-beta-feedback-collection"] ?? "missing"
    }; followUpPlanner=${packageJson?.scripts?.["plan:public-beta-follow-up"] ?? "missing"}; testerInvite=${
      packageJson?.scripts?.["build:public-beta-tester-invite"] ?? "missing"
    }; testerPreflight=${packageJson?.scripts?.["preflight:public-beta-tester"] ?? "missing"}; returnIntake=${
      packageJson?.scripts?.["intake:public-beta-return"] ?? "missing"
    }`
  );

  const startPublicBetaText = fs.existsSync(path.join(packetDir, "START_PUBLIC_BETA.md"))
    ? fs.readFileSync(path.join(packetDir, "START_PUBLIC_BETA.md"), "utf8")
    : "";
  push(
    checks,
    "Public beta packet documents tester launch preflight gate",
    manifest?.testerLaunchGate?.requiredImmediatelyBeforeContact === true &&
      manifest.testerLaunchGate.command === "npm run preflight:public-beta-tester -- --base-url http://127.0.0.1:3000" &&
      manifest.testerLaunchGate.evidencePath === "artifacts/productization/public-beta-tester-session-preflight.json" &&
      manifest.testerLaunchGate.startHereSection === "Launch Preflight Before Contact" &&
      manifest.testerLaunchGate.stopIf?.includes("Do not contact a tester") === true &&
      startHereText.includes("## Launch Preflight Before Contact") &&
      startHereText.includes("Do not contact a tester until this command has just passed") &&
      startHereText.includes("npm run preflight:public-beta-tester -- --base-url http://127.0.0.1:3000") &&
      startHereText.includes("artifacts/productization/public-beta-tester-session-preflight.json") &&
      startHereText.includes("releaseDecision=do_not_release") &&
      manifest.betaCollectionTargets?.some((target) =>
        target.includes("preflight:public-beta-tester immediately before contacting")
      ) === true,
    `command=${manifest?.testerLaunchGate?.command ?? "missing"}; evidence=${
      manifest?.testerLaunchGate?.evidencePath ?? "missing"
    }; documented=${startHereText.includes("## Launch Preflight Before Contact")}`
  );
  push(
    checks,
    "Public beta preparation command is available and documented",
    packageJson?.scripts?.["prepare:public-beta"] === "tsx scripts/prepare-public-beta.ts" &&
      fileExistsWithSize("scripts/prepare-public-beta.ts", 100) &&
      startPublicBetaText.includes("npm run prepare:public-beta -- --base-url http://127.0.0.1:3000"),
    `script=${packageJson?.scripts?.["prepare:public-beta"] ?? "missing"}; file=${fileExistsWithSize(
      "scripts/prepare-public-beta.ts",
      100
    )}; documented=${startPublicBetaText.includes(
      "npm run prepare:public-beta -- --base-url http://127.0.0.1:3000"
    )}`
  );

  push(
    checks,
    "Human acceptance session preflight is verified and packaged",
    humanAcceptancePreflight?.responseMode === "human_acceptance_session_preflight_json_v1" &&
      humanAcceptancePreflight.status === "passed" &&
      humanAcceptancePreflight.canStartHumanAcceptance === true &&
      humanAcceptancePreflight.releaseDecision === "do_not_release" &&
      humanAcceptancePreflight.accepted === false &&
      humanAcceptancePreflight.packagingGated === true &&
      humanAcceptancePreflight.passed === humanAcceptancePreflight.total &&
      Number(humanAcceptancePreflight.total ?? 0) >= 8 &&
      includedDestinations.has("evidence/human-acceptance-session-preflight.json") &&
      packetFileExists("evidence/human-acceptance-session-preflight.json", 100),
    `status=${humanAcceptancePreflight?.status ?? "missing"}; canStart=${
      humanAcceptancePreflight?.canStartHumanAcceptance ?? "missing"
    }; checks=${humanAcceptancePreflight?.passed ?? "?"}/${humanAcceptancePreflight?.total ?? "?"}; packaged=${packetFileExists(
      "evidence/human-acceptance-session-preflight.json",
      100
    )}`
  );

  push(
    checks,
    "Human acceptance reviewer kit is ready and packaged",
    humanAcceptanceReviewerKit?.responseMode === "human_acceptance_reviewer_kit_json_v1" &&
      humanAcceptanceReviewerKit.status === "ready_for_reviewer" &&
      humanAcceptanceReviewerKit.canStartReviewerSession === true &&
      (humanAcceptanceReviewerKit.failedReasons?.length ?? -1) === 0 &&
      humanAcceptanceReviewerKit.releaseDecision === "do_not_release" &&
      humanAcceptanceReviewerKit.accepted === false &&
      humanAcceptanceReviewerKit.packagingGated === true &&
      humanAcceptanceReviewerKit.allSoftwareObjective === "paused" &&
      Number(humanAcceptanceReviewerKit.reviewerSteps?.length ?? 0) >= 6 &&
      includedDestinations.has("evidence/human-acceptance-reviewer-kit.json") &&
      packetFileExists("evidence/human-acceptance-reviewer-kit.json", 100) &&
      includedDestinations.has("docs/HUMAN_ACCEPTANCE_REVIEWER_KIT.md") &&
      packetFileExists("docs/HUMAN_ACCEPTANCE_REVIEWER_KIT.md", 1000),
    `status=${humanAcceptanceReviewerKit?.status ?? "missing"}; canStart=${
      humanAcceptanceReviewerKit?.canStartReviewerSession ?? "missing"
    }; steps=${humanAcceptanceReviewerKit?.reviewerSteps?.length ?? 0}; packaged=${packetFileExists(
      "evidence/human-acceptance-reviewer-kit.json",
      100
    )}/${packetFileExists("docs/HUMAN_ACCEPTANCE_REVIEWER_KIT.md", 1000)}`
  );

  push(
    checks,
    "Human acceptance reviewer kit verification is packaged",
    humanAcceptanceReviewerKitVerification?.responseMode ===
      "human_acceptance_reviewer_kit_verification_json_v1" &&
      humanAcceptanceReviewerKitVerification.status === "passed" &&
      humanAcceptanceReviewerKitVerification.passed === humanAcceptanceReviewerKitVerification.total &&
      Number(humanAcceptanceReviewerKitVerification.total ?? 0) >= 8 &&
      humanAcceptanceReviewerKitVerification.releaseDecision === "do_not_release" &&
      humanAcceptanceReviewerKitVerification.accepted === false &&
      humanAcceptanceReviewerKitVerification.packagingGated === true &&
      includedDestinations.has("evidence/human-acceptance-reviewer-kit-verification.json") &&
      packetFileExists("evidence/human-acceptance-reviewer-kit-verification.json", 100),
    `status=${humanAcceptanceReviewerKitVerification?.status ?? "missing"}; checks=${
      humanAcceptanceReviewerKitVerification?.passed ?? "?"
    }/${humanAcceptanceReviewerKitVerification?.total ?? "?"}; packaged=${packetFileExists(
      "evidence/human-acceptance-reviewer-kit-verification.json",
      100
    )}`
  );

  push(
    checks,
    "Human acceptance reviewer invite is ready and packaged",
    humanAcceptanceReviewerInvite?.responseMode === "human_acceptance_reviewer_invite_json_v1" &&
      humanAcceptanceReviewerInvite.status === "ready_to_invite_reviewer" &&
      humanAcceptanceReviewerInvite.canInviteHumanReviewer === true &&
      (humanAcceptanceReviewerInvite.failedReasons?.length ?? -1) === 0 &&
      humanAcceptanceReviewerInvite.releaseDecision === "do_not_release" &&
      humanAcceptanceReviewerInvite.accepted === false &&
      humanAcceptanceReviewerInvite.packagingGated === true &&
      humanAcceptanceReviewerInvite.allSoftwareObjective === "paused" &&
      includedDestinations.has("evidence/human-acceptance-reviewer-invite.json") &&
      packetFileExists("evidence/human-acceptance-reviewer-invite.json", 100) &&
      includedDestinations.has("docs/HUMAN_ACCEPTANCE_REVIEWER_INVITE.md") &&
      packetFileExists("docs/HUMAN_ACCEPTANCE_REVIEWER_INVITE.md", 1000),
    `status=${humanAcceptanceReviewerInvite?.status ?? "missing"}; canInvite=${
      humanAcceptanceReviewerInvite?.canInviteHumanReviewer ?? "missing"
    }; packaged=${packetFileExists("evidence/human-acceptance-reviewer-invite.json", 100)}/${packetFileExists(
      "docs/HUMAN_ACCEPTANCE_REVIEWER_INVITE.md",
      1000
    )}`
  );

  push(
    checks,
    "Human acceptance reviewer invite verification is packaged",
    humanAcceptanceReviewerInviteVerification?.responseMode ===
      "human_acceptance_reviewer_invite_verification_json_v1" &&
      humanAcceptanceReviewerInviteVerification.status === "passed" &&
      humanAcceptanceReviewerInviteVerification.passed === humanAcceptanceReviewerInviteVerification.total &&
      Number(humanAcceptanceReviewerInviteVerification.total ?? 0) >= 7 &&
      humanAcceptanceReviewerInviteVerification.releaseDecision === "do_not_release" &&
      humanAcceptanceReviewerInviteVerification.accepted === false &&
      humanAcceptanceReviewerInviteVerification.packagingGated === true &&
      humanAcceptanceReviewerInviteVerification.canRelease === false &&
      includedDestinations.has("evidence/human-acceptance-reviewer-invite-verification.json") &&
      packetFileExists("evidence/human-acceptance-reviewer-invite-verification.json", 100),
    `status=${humanAcceptanceReviewerInviteVerification?.status ?? "missing"}; checks=${
      humanAcceptanceReviewerInviteVerification?.passed ?? "?"
    }/${humanAcceptanceReviewerInviteVerification?.total ?? "?"}; packaged=${packetFileExists(
      "evidence/human-acceptance-reviewer-invite-verification.json",
      100
    )}`
  );

  push(
    checks,
    "Human acceptance receipt template is verified and packaged",
    humanAcceptanceReceiptValidation?.responseMode === "human_acceptance_receipt_validation_json_v1" &&
      humanAcceptanceReceiptValidation.status === "template_ready" &&
      humanAcceptanceReceiptValidation.mode === "template" &&
      humanAcceptanceReceiptValidation.passed === humanAcceptanceReceiptValidation.total &&
      Number(humanAcceptanceReceiptValidation.total ?? 0) >= 7 &&
      humanAcceptanceReceiptValidation.releaseDecision === "do_not_release" &&
      humanAcceptanceReceiptValidation.accepted === false &&
      humanAcceptanceReceiptValidation.packagingGated === true &&
      humanAcceptanceReceiptValidation.canRelease === false &&
      includedDestinations.has("docs/HUMAN_ACCEPTANCE_RECEIPT.template.json") &&
      packetFileExists("docs/HUMAN_ACCEPTANCE_RECEIPT.template.json", 100) &&
      includedDestinations.has("docs/HUMAN_ACCEPTANCE_RECEIPT_TEMPLATE.md") &&
      packetFileExists("docs/HUMAN_ACCEPTANCE_RECEIPT_TEMPLATE.md", 500) &&
      includedDestinations.has("evidence/human-acceptance-receipt-validation.json") &&
      packetFileExists("evidence/human-acceptance-receipt-validation.json", 100),
    `status=${humanAcceptanceReceiptValidation?.status ?? "missing"}; checks=${
      humanAcceptanceReceiptValidation?.passed ?? "?"
    }/${humanAcceptanceReceiptValidation?.total ?? "?"}; packaged=${packetFileExists(
      "docs/HUMAN_ACCEPTANCE_RECEIPT.template.json",
      100
    )}/${packetFileExists("evidence/human-acceptance-receipt-validation.json", 100)}`
  );

  push(
    checks,
    "Human acceptance return intake behavior is verified and packaged",
    humanAcceptanceReturnIntakeVerification?.responseMode ===
      "human_acceptance_return_intake_verification_json_v1" &&
      humanAcceptanceReturnIntakeVerification.status === "passed" &&
      humanAcceptanceReturnIntakeVerification.passed === humanAcceptanceReturnIntakeVerification.total &&
      Number(humanAcceptanceReturnIntakeVerification.total ?? 0) >= 3 &&
      humanAcceptanceReturnIntakeVerification.releaseDecision === "do_not_release" &&
      humanAcceptanceReturnIntakeVerification.accepted === false &&
      humanAcceptanceReturnIntakeVerification.packagingGated === true &&
      humanAcceptanceReturnIntakeVerification.canRelease === false &&
      includedDestinations.has("evidence/human-acceptance-return-intake-verification.json") &&
      packetFileExists("evidence/human-acceptance-return-intake-verification.json", 100),
    `status=${humanAcceptanceReturnIntakeVerification?.status ?? "missing"}; checks=${
      humanAcceptanceReturnIntakeVerification?.passed ?? "?"
    }/${humanAcceptanceReturnIntakeVerification?.total ?? "?"}; packaged=${packetFileExists(
      "evidence/human-acceptance-return-intake-verification.json",
      100
    )}`
  );

  push(
    checks,
    "Productization evidence freshness is verified and packaged",
    productizationEvidenceFreshness?.responseMode === "productization_evidence_freshness_json_v1" &&
      productizationEvidenceFreshness.status === "passed" &&
      productizationEvidenceFreshness.releaseDecision === "do_not_release" &&
      productizationEvidenceFreshness.allSoftwareObjective === "paused" &&
      productizationEvidenceFreshness.accepted === false &&
      productizationEvidenceFreshness.packagingGated === true &&
      productizationEvidenceFreshness.canRelease === false &&
      productizationEvidenceFreshness.passed === productizationEvidenceFreshness.total &&
      Number(productizationEvidenceFreshness.total ?? 0) >= 8 &&
      includedDestinations.has("evidence/productization-evidence-freshness.json") &&
      packetFileExists("evidence/productization-evidence-freshness.json", 100),
    `status=${productizationEvidenceFreshness?.status ?? "missing"}; checks=${
      productizationEvidenceFreshness?.passed ?? "?"
    }/${productizationEvidenceFreshness?.total ?? "?"}; packaged=${packetFileExists(
      "evidence/productization-evidence-freshness.json",
      100
    )}`
  );

  push(
    checks,
    "Product status summary is ready and packaged",
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
      productStatusSummary.nextBestActions?.some(
        (action) => action.id === "invite_one_bounded_beta_tester" && action.allowed === true
      ) === true &&
      productStatusSummaryVerification?.responseMode === "product_status_summary_verification_json_v1" &&
      productStatusSummaryVerification.status === "passed" &&
      productStatusSummaryVerification.passed === productStatusSummaryVerification.total &&
      productStatusSummaryVerification.releaseDecision === "do_not_release" &&
      productStatusSummaryVerification.accepted === false &&
      productStatusSummaryVerification.packagingGated === true &&
      productStatusSummaryVerification.canRelease === false &&
      includedDestinations.has("evidence/product-status-summary.json") &&
      packetFileExists("evidence/product-status-summary.json", 100) &&
      includedDestinations.has("evidence/product-status-summary-verification.json") &&
      packetFileExists("evidence/product-status-summary-verification.json", 100) &&
      includedDestinations.has("docs/PRODUCT_STATUS_SUMMARY.md") &&
      packetFileExists("docs/PRODUCT_STATUS_SUMMARY.md", 1000),
    `summary=${productStatusSummary?.status ?? "missing"}; beta=${productStatusSummary?.betaCanStart ?? "missing"}; verification=${
      productStatusSummaryVerification?.status ?? "missing"
    } ${productStatusSummaryVerification?.passed ?? "?"}/${productStatusSummaryVerification?.total ?? "?"}; packaged=${packetFileExists(
      "evidence/product-status-summary.json",
      100
    )}`
  );
  push(
    checks,
    "Productization launch checklist is ready and packaged",
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
      productizationLaunchChecklistVerification.canActivateRealModel === false &&
      includedDestinations.has("evidence/productization-launch-checklist.json") &&
      packetFileExists("evidence/productization-launch-checklist.json", 100) &&
      includedDestinations.has("evidence/productization-launch-checklist-verification.json") &&
      packetFileExists("evidence/productization-launch-checklist-verification.json", 100) &&
      includedDestinations.has("docs/PRODUCTIZATION_LAUNCH_CHECKLIST.md") &&
      packetFileExists("docs/PRODUCTIZATION_LAUNCH_CHECKLIST.md", 1000),
    `status=${productizationLaunchChecklist?.status ?? "missing"}; verifier=${
      productizationLaunchChecklistVerification?.status ?? "missing"
    } ${productizationLaunchChecklistVerification?.passed ?? "?"}/${
      productizationLaunchChecklistVerification?.total ?? "?"
    }; packaged=${packetFileExists("docs/PRODUCTIZATION_LAUNCH_CHECKLIST.md", 1000)}`
  );


  push(
    checks,
    "Public beta packet preserves real-model redaction in first-read handoff docs",
    productizationLaunchChecklist?.lanes?.some(
      (lane) =>
        lane.id === "real_model_trial" &&
        lane.evidencePath === "artifacts/productization/real-model-trial-kit.md" &&
        lane.redactionChecklistPath === "artifacts/productization/real-model-trial-kit.md#credential-redaction-checklist" &&
        lane.stopCondition?.includes("credential redaction checklist") === true &&
        lane.stopCondition?.includes("rollback_to_mock_after_trial") === true &&
        lane.stopCondition?.includes("returned artifacts contain secrets") === true
    ) === true &&
      packetTakeoverMatrixText.includes("artifacts/productization/real-model-trial-kit.md#credential-redaction-checklist") &&
      packetTakeoverMatrixText.includes("rollback_to_mock_after_trial") &&
      packetTakeoverMatrixText.includes("returned artifacts contain secrets") &&
      packetLaunchChecklistText.includes("artifacts/productization/real-model-trial-kit.md#credential-redaction-checklist") &&
      packetLaunchChecklistText.includes("rollback_to_mock_after_trial") &&
      packetLaunchChecklistText.includes("returned artifacts contain secrets"),
    `lane=${productizationLaunchChecklist?.lanes?.some((lane) => lane.id === "real_model_trial" && lane.redactionChecklistPath === "artifacts/productization/real-model-trial-kit.md#credential-redaction-checklist") ?? false}; takeover=${packetTakeoverMatrixText.includes("rollback_to_mock_after_trial")}; launch=${packetLaunchChecklistText.includes("rollback_to_mock_after_trial")}`
  );

  push(
    checks,
    "Takeover entry consistency evidence is packaged and green",
    takeoverEntryConsistency?.responseMode === "product_takeover_entry_consistency_verification_json_v1" &&
      takeoverEntryConsistency.status === "passed" &&
      takeoverEntryConsistency.passed === takeoverEntryConsistency.total &&
      Number(takeoverEntryConsistency.total ?? 0) >= 9 &&
      takeoverEntryConsistency.releaseDecision === "do_not_release" &&
      takeoverEntryConsistency.allSoftwareObjective === "paused" &&
      takeoverEntryConsistency.accepted === false &&
      takeoverEntryConsistency.packagingGated === true &&
      takeoverEntryConsistency.canRelease === false &&
      includedDestinations.has("evidence/product-takeover-entry-consistency.json") &&
      packetFileExists("evidence/product-takeover-entry-consistency.json", 100),
    `status=${takeoverEntryConsistency?.status ?? "missing"}; checks=${takeoverEntryConsistency?.passed ?? "?"}/${
      takeoverEntryConsistency?.total ?? "?"
    }; packaged=${packetFileExists("evidence/product-takeover-entry-consistency.json", 100)}`
  );
  push(
    checks,
    "Product operator brief is ready and packaged",
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
      operatorBrief.blockedActions?.some((action) => action.id === "release_product" && action.blocked === true) === true &&
      operatorBrief.blockedActions.some((action) => action.id === "unlock_packaging" && action.blocked === true) &&
      operatorBrief.blockedActions.some((action) => action.id === "resume_all_software_scope" && action.blocked === true) &&
      operatorBrief.blockedActions.some((action) => action.id === "activate_real_model_from_fake_fetch" && action.blocked === true) &&
      operatorBriefVerification?.responseMode === "product_operator_brief_verification_json_v1" &&
      operatorBriefVerification.status === "passed" &&
      operatorBriefVerification.passed === operatorBriefVerification.total &&
      Number(operatorBriefVerification.total ?? 0) >= 6 &&
      operatorBriefVerification.releaseDecision === "do_not_release" &&
      operatorBriefVerification.accepted === false &&
      operatorBriefVerification.packagingGated === true &&
      operatorBriefVerification.canRelease === false &&
      includedDestinations.has("evidence/product-operator-brief.json") &&
      packetFileExists("evidence/product-operator-brief.json", 100) &&
      includedDestinations.has("evidence/product-operator-brief-verification.json") &&
      packetFileExists("evidence/product-operator-brief-verification.json", 100) &&
      includedDestinations.has("docs/PRODUCT_OPERATOR_BRIEF.md") &&
      packetFileExists("docs/PRODUCT_OPERATOR_BRIEF.md", 1000) && packetFileExists("docs/PRODUCT_TAKEOVER_DECISION_MATRIX.md", 1000) && packetFileExists("docs/PRODUCTIZATION_LAUNCH_CHECKLIST.md", 1000) && packetFileExists("evidence/productization-launch-checklist.json", 100) && packetFileExists("evidence/productization-launch-checklist-verification.json", 100) && packetFileExists("evidence/product-takeover-decision-matrix.json", 100) && packetFileExists("evidence/product-takeover-decision-matrix-verification.json", 100),
    `brief=${operatorBrief?.status ?? "missing"}; beta=${operatorBrief?.canInviteBoundedBetaTester ?? "missing"}; human=${
      operatorBrief?.canStartHumanAcceptanceReview ?? "missing"
    }; modelTrial=${operatorBrief?.canPlanRealModelTrial ?? "missing"}; verification=${
      operatorBriefVerification?.status ?? "missing"
    } ${operatorBriefVerification?.passed ?? "?"}/${operatorBriefVerification?.total ?? "?"}; packaged=${packetFileExists("docs/PRODUCT_OPERATOR_BRIEF.md", 1000) && packetFileExists("docs/PRODUCT_TAKEOVER_DECISION_MATRIX.md", 1000) && packetFileExists("docs/PRODUCTIZATION_LAUNCH_CHECKLIST.md", 1000) && packetFileExists("evidence/productization-launch-checklist.json", 100) && packetFileExists("evidence/productization-launch-checklist-verification.json", 100) && packetFileExists("evidence/product-takeover-decision-matrix.json", 100) && packetFileExists("evidence/product-takeover-decision-matrix-verification.json", 100)}`
  );

  push(
    checks,
    "Product release blocker board is ready and packaged",
    releaseBlockerBoard?.responseMode === "product_release_blocker_board_json_v1" &&
      releaseBlockerBoard.status === "ready_for_blocker_resolution" &&
      releaseBlockerBoard.releaseDecision === "do_not_release" &&
      releaseBlockerBoard.accepted === false &&
      releaseBlockerBoard.packagingGated === true &&
      releaseBlockerBoard.canRelease === false &&
      (releaseBlockerBoard.failedReasons?.length ?? -1) === 0 &&
      Number(releaseBlockerBoard.lanes?.length ?? 0) === 3 &&
      includedDestinations.has("evidence/product-release-blocker-board.json") &&
      packetFileExists("evidence/product-release-blocker-board.json", 100) &&
      includedDestinations.has("docs/PRODUCT_RELEASE_BLOCKER_BOARD.md") &&
      packetFileExists("docs/PRODUCT_RELEASE_BLOCKER_BOARD.md", 1000),
    `status=${releaseBlockerBoard?.status ?? "missing"}; lanes=${
      releaseBlockerBoard?.lanes?.length ?? 0
    }; packaged=${packetFileExists("evidence/product-release-blocker-board.json", 100)}/${packetFileExists(
      "docs/PRODUCT_RELEASE_BLOCKER_BOARD.md",
      1000
    )}`
  );

  push(
    checks,
    "Product release blocker board verification is packaged",
    releaseBlockerBoardVerification?.responseMode ===
      "product_release_blocker_board_verification_json_v1" &&
      releaseBlockerBoardVerification.status === "passed" &&
      releaseBlockerBoardVerification.passed === releaseBlockerBoardVerification.total &&
      Number(releaseBlockerBoardVerification.total ?? 0) >= 10 &&
      releaseBlockerBoardVerification.releaseDecision === "do_not_release" &&
      releaseBlockerBoardVerification.accepted === false &&
      releaseBlockerBoardVerification.packagingGated === true &&
      releaseBlockerBoardVerification.canRelease === false &&
      includedDestinations.has("evidence/product-release-blocker-board-verification.json") &&
      packetFileExists("evidence/product-release-blocker-board-verification.json", 100),
    `status=${releaseBlockerBoardVerification?.status ?? "missing"}; checks=${
      releaseBlockerBoardVerification?.passed ?? "?"
    }/${releaseBlockerBoardVerification?.total ?? "?"}; packaged=${packetFileExists(
      "evidence/product-release-blocker-board-verification.json",
      100
    )}`
  );

  push(
    checks,
    "Product release approval receipt template is verified and packaged",
    productReleaseApprovalValidation?.responseMode === "product_release_approval_validation_json_v1" &&
      productReleaseApprovalValidation.status === "template_ready" &&
      productReleaseApprovalValidation.mode === "template" &&
      productReleaseApprovalValidation.passed === productReleaseApprovalValidation.total &&
      Number(productReleaseApprovalValidation.total ?? 0) >= 7 &&
      productReleaseApprovalValidation.releaseDecision === "do_not_release" &&
      productReleaseApprovalValidation.accepted === false &&
      productReleaseApprovalValidation.packagingGated === true &&
      productReleaseApprovalValidation.canRelease === false &&
      includedDestinations.has("docs/PRODUCT_RELEASE_APPROVAL.template.json") &&
      packetFileExists("docs/PRODUCT_RELEASE_APPROVAL.template.json", 100) &&
      includedDestinations.has("docs/PRODUCT_RELEASE_APPROVAL_TEMPLATE.md") &&
      packetFileExists("docs/PRODUCT_RELEASE_APPROVAL_TEMPLATE.md", 500) &&
      includedDestinations.has("evidence/product-release-approval-validation.json") &&
      packetFileExists("evidence/product-release-approval-validation.json", 100),
    `status=${productReleaseApprovalValidation?.status ?? "missing"}; checks=${
      productReleaseApprovalValidation?.passed ?? "?"
    }/${productReleaseApprovalValidation?.total ?? "?"}; packaged=${packetFileExists(
      "docs/PRODUCT_RELEASE_APPROVAL.template.json",
      100
    )}/${packetFileExists("evidence/product-release-approval-validation.json", 100)}`
  );


  push(
    checks,
    "Product release approval return intake behavior is verified and packaged",
    productReleaseApprovalReturnIntakeVerification?.responseMode ===
      "product_release_approval_return_intake_verification_json_v1" &&
      productReleaseApprovalReturnIntakeVerification.status === "passed" &&
      productReleaseApprovalReturnIntakeVerification.passed === productReleaseApprovalReturnIntakeVerification.total &&
      Number(productReleaseApprovalReturnIntakeVerification.total ?? 0) >= 3 &&
      productReleaseApprovalReturnIntakeVerification.releaseDecision === "do_not_release" &&
      productReleaseApprovalReturnIntakeVerification.accepted === false &&
      productReleaseApprovalReturnIntakeVerification.packagingGated === true &&
      productReleaseApprovalReturnIntakeVerification.canRelease === false &&
      includedDestinations.has("evidence/product-release-approval-return-intake-verification.json") &&
      packetFileExists("evidence/product-release-approval-return-intake-verification.json", 100),
    `status=${productReleaseApprovalReturnIntakeVerification?.status ?? "missing"}; checks=${
      productReleaseApprovalReturnIntakeVerification?.passed ?? "?"
    }/${productReleaseApprovalReturnIntakeVerification?.total ?? "?"}; packaged=${packetFileExists(
      "evidence/product-release-approval-return-intake-verification.json",
      100
    )}`
  );
  push(
    checks,
    "Real model adapter contract is verified and packaged",
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
      realModelAdapterContract.canRelease === false &&
      includedDestinations.has("evidence/real-model-adapter-contract-verification.json") &&
      packetFileExists("evidence/real-model-adapter-contract-verification.json", 100),
    `status=${realModelAdapterContract?.status ?? "missing"}; checks=${
      realModelAdapterContract?.passed ?? "?"
    }/${realModelAdapterContract?.total ?? "?"}; packaged=${packetFileExists(
      "evidence/real-model-adapter-contract-verification.json",
      100
    )}`
  );

  push(
    checks,
    "Real model trial kit is ready, locked, and packaged",
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
      realModelTrialKit.aiService.realModelReady === false &&
      includedDestinations.has("evidence/real-model-trial-kit.json") &&
      packetFileExists("evidence/real-model-trial-kit.json", 100) &&
      includedDestinations.has("docs/REAL_MODEL_TRIAL_KIT.md") &&
      packetFileExists("docs/REAL_MODEL_TRIAL_KIT.md", 1000) &&
      readPacketText("docs/REAL_MODEL_TRIAL_KIT.md").includes("Credential Redaction Checklist") &&
      readPacketText("docs/REAL_MODEL_TRIAL_KIT.md").includes("rollback_to_mock_after_trial"),
    `status=${realModelTrialKit?.status ?? "missing"}; activeProvider=${
      realModelTrialKit?.aiService?.activeProvider ?? "missing"
    }; redaction=${Array.from(realModelTrialKitRedactionIds).join(",") || "missing"}; packaged=${packetFileExists(
      "evidence/real-model-trial-kit.json",
      100
    )}/${packetFileExists("docs/REAL_MODEL_TRIAL_KIT.md", 1000)}`
  );

  push(
    checks,
    "Real model trial kit verification is packaged",
    realModelTrialKitVerification?.responseMode === "real_model_trial_kit_verification_json_v1" &&
      realModelTrialKitVerification.status === "passed" &&
      realModelTrialKitVerification.passed === realModelTrialKitVerification.total &&
      Number(realModelTrialKitVerification.total ?? 0) >= 9 &&
      realModelTrialKitVerification.releaseDecision === "do_not_release" &&
      realModelTrialKitVerification.accepted === false &&
      realModelTrialKitVerification.packagingGated === true &&
      realModelTrialKitVerification.canActivateRealModel === false &&
      realModelTrialKitVerification.canRelease === false &&
      includedDestinations.has("evidence/real-model-trial-kit-verification.json") &&
      packetFileExists("evidence/real-model-trial-kit-verification.json", 100),
    `status=${realModelTrialKitVerification?.status ?? "missing"}; checks=${
      realModelTrialKitVerification?.passed ?? "?"
    }/${realModelTrialKitVerification?.total ?? "?"}; packaged=${packetFileExists(
      "evidence/real-model-trial-kit-verification.json",
      100
    )}`
  );

  push(
    checks,
    "Real model trial receipt template is verified and packaged",
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
      includedDestinations.has("docs/REAL_MODEL_TRIAL_RECEIPT.template.json") &&
      packetFileExists("docs/REAL_MODEL_TRIAL_RECEIPT.template.json", 100) &&
      includedDestinations.has("docs/REAL_MODEL_TRIAL_RECEIPT_TEMPLATE.md") &&
      packetFileExists("docs/REAL_MODEL_TRIAL_RECEIPT_TEMPLATE.md", 500) &&
      includedDestinations.has("evidence/real-model-trial-receipt-validation.json") &&
      packetFileExists("evidence/real-model-trial-receipt-validation.json", 100),
    `status=${realModelTrialReceiptValidation?.status ?? "missing"}; checks=${
      realModelTrialReceiptValidation?.passed ?? "?"
    }/${realModelTrialReceiptValidation?.total ?? "?"}; packaged=${packetFileExists(
      "docs/REAL_MODEL_TRIAL_RECEIPT.template.json",
      100
    )}/${packetFileExists("evidence/real-model-trial-receipt-validation.json", 100)}`
  );


  push(
    checks,
    "Real model trial return intake behavior is verified and packaged",
    realModelTrialReturnIntakeVerification?.responseMode === "real_model_trial_return_intake_verification_json_v1" &&
      realModelTrialReturnIntakeVerification.status === "passed" &&
      realModelTrialReturnIntakeVerification.passed === realModelTrialReturnIntakeVerification.total &&
      Number(realModelTrialReturnIntakeVerification.total ?? 0) >= 3 &&
      realModelTrialReturnIntakeVerification.releaseDecision === "do_not_release" &&
      realModelTrialReturnIntakeVerification.accepted === false &&
      realModelTrialReturnIntakeVerification.packagingGated === true &&
      realModelTrialReturnIntakeVerification.canActivateRealModel === false &&
      realModelTrialReturnIntakeVerification.canRelease === false &&
      includedDestinations.has("evidence/real-model-trial-return-intake-verification.json") &&
      packetFileExists("evidence/real-model-trial-return-intake-verification.json", 100),
    `status=${realModelTrialReturnIntakeVerification?.status ?? "missing"}; checks=${
      realModelTrialReturnIntakeVerification?.passed ?? "?"
    }/${realModelTrialReturnIntakeVerification?.total ?? "?"}; packaged=${packetFileExists(
      "evidence/real-model-trial-return-intake-verification.json",
      100
    )}`
  );
  push(
    checks,
    "Public beta feedback API behavior is verified and packaged",
    feedbackApiVerification?.responseMode === "public_beta_feedback_api_verification_json_v1" &&
      feedbackApiVerification.status === "passed" &&
      feedbackApiVerification.passed === feedbackApiVerification.total &&
      Number(feedbackApiVerification.total ?? 0) >= 5 &&
      feedbackApiVerification.releaseDecision === "do_not_release" &&
      feedbackApiVerification.accepted === false &&
      feedbackApiVerification.packagingGated === true &&
      feedbackApiVerification.tempArtifactsCleaned === true &&
      includedDestinations.has("evidence/public-beta-feedback-api-verification.json") &&
      packetFileExists("evidence/public-beta-feedback-api-verification.json", 100),
    `status=${feedbackApiVerification?.status ?? "missing"}; checks=${
      feedbackApiVerification?.passed ?? "?"
    }/${feedbackApiVerification?.total ?? "?"}; tempCleaned=${
      feedbackApiVerification?.tempArtifactsCleaned ?? "missing"
    }; packaged=${packetFileExists("evidence/public-beta-feedback-api-verification.json", 100)}`
  );

  push(
    checks,
    "Public beta feedback collection behavior is verified and packaged",
    feedbackCollectionVerification?.responseMode ===
      "public_beta_feedback_collection_verification_json_v1" &&
      feedbackCollectionVerification.status === "passed" &&
      feedbackCollectionVerification.passed === feedbackCollectionVerification.total &&
      Number(feedbackCollectionVerification.total ?? 0) >= 7 &&
      feedbackCollectionVerification.releaseDecision === "do_not_release" &&
      feedbackCollectionVerification.accepted === false &&
      feedbackCollectionVerification.packagingGated === true &&
      includedDestinations.has("evidence/public-beta-feedback-collection-verification.json") &&
      packetFileExists("evidence/public-beta-feedback-collection-verification.json", 100),
    `status=${feedbackCollectionVerification?.status ?? "missing"}; checks=${
      feedbackCollectionVerification?.passed ?? "?"
    }/${feedbackCollectionVerification?.total ?? "?"}; packaged=${packetFileExists(
      "evidence/public-beta-feedback-collection-verification.json",
      100
    )}`
  );

  push(
    checks,
    "Public beta follow-up plan is generated, locked, and packaged",
    followUpPlan?.responseMode === "public_beta_follow_up_plan_json_v1" &&
      ["waiting_for_feedback", "ready_for_next_beta_tester"].includes(followUpPlan.status ?? "") &&
      followUpPlan.releaseDecision === "do_not_release" &&
      followUpPlan.accepted === false &&
      followUpPlan.packagingGated === true &&
      followUpPlan.locks?.mustNotSaveAcceptance === true &&
      followUpPlan.locks.mustNotUnlockPackaging === true &&
      followUpPlan.locks.mustNotClaimReleaseReady === true &&
      followUpPlan.locks.mustNotResumeAllSoftwareObjective === true &&
      Number(followUpPlan.actions?.length ?? 0) >= 2 &&
      includedDestinations.has("evidence/public-beta-follow-up-plan.json") &&
      packetFileExists("evidence/public-beta-follow-up-plan.json", 100),
    `status=${followUpPlan?.status ?? "missing"}; invite=${
      followUpPlan?.canInviteNextTester ?? "missing"
    }; actions=${followUpPlan?.actions?.length ?? "?"}; packaged=${packetFileExists(
      "evidence/public-beta-follow-up-plan.json",
      100
    )}`
  );

  push(
    checks,
    "Public beta follow-up plan behavior is verified and packaged",
    followUpPlanVerification?.responseMode === "public_beta_follow_up_plan_verification_json_v1" &&
      followUpPlanVerification.status === "passed" &&
      followUpPlanVerification.passed === followUpPlanVerification.total &&
      Number(followUpPlanVerification.total ?? 0) >= 6 &&
      followUpPlanVerification.releaseDecision === "do_not_release" &&
      followUpPlanVerification.accepted === false &&
      followUpPlanVerification.packagingGated === true &&
      includedDestinations.has("evidence/public-beta-follow-up-plan-verification.json") &&
      packetFileExists("evidence/public-beta-follow-up-plan-verification.json", 100),
    `status=${followUpPlanVerification?.status ?? "missing"}; checks=${
      followUpPlanVerification?.passed ?? "?"
    }/${followUpPlanVerification?.total ?? "?"}; packaged=${packetFileExists(
      "evidence/public-beta-follow-up-plan-verification.json",
      100
    )}`
  );

  push(
    checks,
    "Public beta tester invite kit is ready, locked, and packaged",
    testerInvite?.responseMode === "public_beta_tester_invite_json_v1" &&
      testerInvite.status === "ready_to_invite" &&
      testerInvite.canInvite === true &&
      (testerInvite.failedReasons?.length ?? -1) === 0 &&
      testerInvite.releaseDecision === "do_not_release" &&
      testerInvite.accepted === false &&
      testerInvite.packagingGated === true &&
      testerInvite.locks?.mustNotSaveAcceptance === true &&
      testerInvite.locks.mustNotUnlockPackaging === true &&
      testerInvite.locks.mustNotClaimReleaseReady === true &&
      testerInvite.locks.mustNotResumeAllSoftwareObjective === true &&
      Number(testerInvite.testerChecklist?.length ?? 0) >= 6 &&
      Number(testerInvite.maintainerChecklist?.length ?? 0) >= 6 &&
      testerInvite.launchPreflight?.requiredImmediatelyBeforeContact === true &&
      testerInvite.launchPreflight.command === "npm run preflight:public-beta-tester -- --base-url http://127.0.0.1:3000" &&
      testerInvite.launchPreflight.evidencePath === "artifacts/productization/public-beta-tester-session-preflight.json" &&
      testerInvite.launchPreflight.mustBeGeneratedAfterInvite === true &&
      testerInvite.launchPreflight.mustBeGeneratedAfterProductizationFreshness === true &&
      testerInvite.expectedReturnedEvidence?.some((item) => item.includes("human_review")) === true &&
      testerInvite.maintainerChecklist?.some((item) =>
        item.includes("npm run verify:public-beta-feedback -- --receipt <path>")
      ) === true &&
      testerInvite.maintainerChecklist?.some((item) =>
        item.includes("npm run intake:public-beta-return -- --receipt <path> --session-receipt <session-receipt-path> --send-receipt-validation artifacts/productization/first-real-tester-send-receipt-validation.json")
      ) === true &&
      testerInvite.maintainerChecklist?.some((item) => item.includes("Send the tester") && item.includes("PUBLIC_BETA_FEEDBACK_RECEIPT.template.json") && item.includes("keep docs/PUBLIC_BETA_SESSION_RECEIPT.template.json with the facilitator/maintainer")) === true &&
      testerInvite.maintainerChecklist?.some((item) => item.includes("Place valid returned receipts")) !== true &&
      includedDestinations.has("evidence/public-beta-tester-invite.json") &&
      packetFileExists("evidence/public-beta-tester-invite.json", 100) &&
      packetFileExists("docs/PUBLIC_BETA_TESTER_INVITE.md", 500) &&
      packetFileExists("docs/PUBLIC_BETA_SESSION_PLAN.md", 1000),
    `status=${testerInvite?.status ?? "missing"}; invite=${testerInvite?.canInvite ?? "missing"}; failed=${
      testerInvite?.failedReasons?.join(",") || "none"
    }; roleSplit=${testerInvite?.maintainerChecklist?.some((item) => item.includes("Send the tester") && item.includes("PUBLIC_BETA_FEEDBACK_RECEIPT.template.json") && item.includes("keep docs/PUBLIC_BETA_SESSION_RECEIPT.template.json with the facilitator/maintainer"))}; intake=${testerInvite?.maintainerChecklist?.some((item) =>
      item.includes("npm run intake:public-beta-return -- --receipt <path> --session-receipt <session-receipt-path> --send-receipt-validation artifacts/productization/first-real-tester-send-receipt-validation.json")
    )}; packaged=${packetFileExists("evidence/public-beta-tester-invite.json", 100)}`
  );

  push(
    checks,
    "Public beta tester invite kit is verified and packaged",
    testerInviteVerification?.responseMode === "public_beta_tester_invite_verification_json_v1" &&
      testerInviteVerification.status === "passed" &&
      testerInviteVerification.passed === testerInviteVerification.total &&
      Number(testerInviteVerification.total ?? 0) >= 5 &&
      testerInviteVerification.releaseDecision === "do_not_release" &&
      testerInviteVerification.accepted === false &&
      testerInviteVerification.packagingGated === true &&
      includedDestinations.has("evidence/public-beta-tester-invite-verification.json") &&
      packetFileExists("evidence/public-beta-tester-invite-verification.json", 100),
    `status=${testerInviteVerification?.status ?? "missing"}; checks=${
      testerInviteVerification?.passed ?? "?"
    }/${testerInviteVerification?.total ?? "?"}; packaged=${packetFileExists(
      "evidence/public-beta-tester-invite-verification.json",
      100
    )}`
  );


  push(
    checks,
    "Public beta session plan is ready, locked, and packaged",
    publicBetaSessionPlan?.responseMode === "public_beta_session_plan_json_v1" &&
      publicBetaSessionPlan.status === "ready_for_session" &&
      publicBetaSessionPlan.canStartSession === true &&
      (publicBetaSessionPlan.failedReasons?.length ?? -1) === 0 &&
      publicBetaSessionPlan.releaseDecision === "do_not_release" &&
      publicBetaSessionPlan.reviewOnly === true &&
      publicBetaSessionPlan.accepted === false &&
      publicBetaSessionPlan.packagingGated === true &&
      publicBetaSessionPlan.launchPreflight?.requiredImmediatelyBeforeContact === true &&
      publicBetaSessionPlan.launchPreflight.command === "npm run preflight:public-beta-tester -- --base-url http://127.0.0.1:3000" &&
      publicBetaSessionPlan.launchPreflight.evidencePath === "artifacts/productization/public-beta-tester-session-preflight.json" &&
      Number(publicBetaSessionPlan.sessionPhases?.length ?? 0) >= 4 &&
      publicBetaSessionPlan.returnPipeline?.includes("npm run intake:public-beta-return -- --receipt path/to/submitted-feedback.json --session-receipt path/to/filled-public-beta-session-receipt.json --send-receipt-validation artifacts/productization/first-real-tester-send-receipt-validation.json") === true &&
      publicBetaSessionPlan.receiptBindingRule?.includes("same tester.name and tester.date") === true &&
      publicBetaSessionPlan.receiptBindingRule?.includes("sessionEvidence.feedbackReceiptPath") === true &&
      publicBetaSessionPlan.locks?.mustNotSaveAcceptance === true &&
      publicBetaSessionPlan.locks.mustNotUnlockPackaging === true &&
      publicBetaSessionPlan.locks.mustNotClaimReleaseReady === true &&
      publicBetaSessionPlan.locks.mustNotResumeAllSoftwareObjective === true &&
      publicBetaSessionPlan.locks.mustNotActivateRealModel === true &&
      includedDestinations.has("evidence/public-beta-session-plan.json") &&
      includedDestinations.has("docs/PUBLIC_BETA_SESSION_PLAN.md") &&
      packetFileExists("evidence/public-beta-session-plan.json", 100) &&
      packetFileExists("docs/PUBLIC_BETA_SESSION_PLAN.md", 1000),
    `status=${publicBetaSessionPlan?.status ?? "missing"}; canStart=${publicBetaSessionPlan?.canStartSession ?? "missing"}; phases=${
      publicBetaSessionPlan?.sessionPhases?.length ?? 0
    }; binding=${publicBetaSessionPlan?.receiptBindingRule?.includes("same tester.name and tester.date")}; packaged=${packetFileExists("docs/PUBLIC_BETA_SESSION_PLAN.md", 1000)}`
  );

  push(
    checks,
    "Public beta session receipt template is verified and packaged",
    publicBetaSessionReceiptValidation?.responseMode === "public_beta_session_receipt_validation_json_v1" &&
      publicBetaSessionReceiptValidation.status === "template_ready" &&
      publicBetaSessionReceiptValidation.mode === "template" &&
      publicBetaSessionReceiptValidation.releaseDecision === "do_not_release" &&
      publicBetaSessionReceiptValidation.reviewOnly === true &&
      publicBetaSessionReceiptValidation.accepted === false &&
      publicBetaSessionReceiptValidation.packagingGated === true &&
      publicBetaSessionReceiptValidation.canRelease === false &&
      publicBetaSessionReceiptValidation.passed === publicBetaSessionReceiptValidation.total &&
      Number(publicBetaSessionReceiptValidation.total ?? 0) >= 9 &&
      includedDestinations.has("docs/PUBLIC_BETA_SESSION_RECEIPT.template.json") &&
      includedDestinations.has("docs/PUBLIC_BETA_SESSION_RECEIPT_TEMPLATE.md") &&
      includedDestinations.has("evidence/public-beta-session-receipt-validation.json") &&
      packetFileExists("docs/PUBLIC_BETA_SESSION_RECEIPT.template.json", 1000) &&
      packetFileExists("docs/PUBLIC_BETA_SESSION_RECEIPT_TEMPLATE.md", 500) &&
      packetFileExists("evidence/public-beta-session-receipt-validation.json", 100),
    `status=${publicBetaSessionReceiptValidation?.status ?? "missing"}; checks=${
      publicBetaSessionReceiptValidation?.passed ?? "?"
    }/${publicBetaSessionReceiptValidation?.total ?? "?"}; packaged=${packetFileExists(
      "docs/PUBLIC_BETA_SESSION_RECEIPT.template.json",
      1000
    )}`
  );

  push(
    checks,
    "Public beta session plan is verified and packaged",
    publicBetaSessionPlanVerification?.responseMode === "public_beta_session_plan_verification_json_v1" &&
      publicBetaSessionPlanVerification.status === "passed" &&
      publicBetaSessionPlanVerification.passed === publicBetaSessionPlanVerification.total &&
      Number(publicBetaSessionPlanVerification.total ?? 0) >= 8 &&
      publicBetaSessionPlanVerification.releaseDecision === "do_not_release" &&
      publicBetaSessionPlanVerification.accepted === false &&
      publicBetaSessionPlanVerification.packagingGated === true &&
      includedDestinations.has("evidence/public-beta-session-plan-verification.json") &&
      packetFileExists("evidence/public-beta-session-plan-verification.json", 100),
    `status=${publicBetaSessionPlanVerification?.status ?? "missing"}; checks=${
      publicBetaSessionPlanVerification?.passed ?? "?"
    }/${publicBetaSessionPlanVerification?.total ?? "?"}; packaged=${packetFileExists(
      "evidence/public-beta-session-plan-verification.json",
      100
    )}`
  );

  const testerSessionPreflightExists = fileExistsWithSize(
    "artifacts/productization/public-beta-tester-session-preflight.json",
    100
  );
  const testerSessionPreflightFreshEnough =
    testerSessionPreflightExists &&
    isAtOrAfterTimestamp(testerSessionPreflight?.generatedAt, productizationEvidenceFreshness?.generatedAt);
  push(
    checks,
    "Public beta tester session preflight is packaged when fresh",
    !testerSessionPreflightExists ||
      !testerSessionPreflightFreshEnough ||
      (testerSessionPreflight?.responseMode === "public_beta_tester_session_preflight_json_v1" &&
        testerSessionPreflight.status === "passed" &&
        testerSessionPreflight.canInviteTester === true &&
        testerSessionPreflight.passed === testerSessionPreflight.total &&
        Number(testerSessionPreflight.total ?? 0) >= 10 &&
        testerSessionPreflight.releaseDecision === "do_not_release" &&
        testerSessionPreflight.accepted === false &&
        testerSessionPreflight.packagingGated === true &&
        includedDestinations.has("evidence/public-beta-tester-session-preflight.json") &&
        packetFileExists("evidence/public-beta-tester-session-preflight.json", 100)),
    `rootEvidence=${testerSessionPreflightExists}; freshEnough=${testerSessionPreflightFreshEnough}; status=${testerSessionPreflight?.status ?? "missing"}; checks=${
      testerSessionPreflight?.passed ?? "?"
    }/${testerSessionPreflight?.total ?? "?"}; packaged=${packetFileExists(
      "evidence/public-beta-tester-session-preflight.json",
      100
    )}`
  );

  push(
    checks,
    "Public beta return intake behavior is verified and packaged",
    returnIntakeVerification?.responseMode === "public_beta_return_intake_verification_json_v1" &&
      returnIntakeVerification.status === "passed" &&
      returnIntakeVerification.passed === returnIntakeVerification.total &&
      Number(returnIntakeVerification.total ?? 0) >= 3 &&
      returnIntakeVerification.releaseDecision === "do_not_release" &&
      returnIntakeVerification.accepted === false &&
      returnIntakeVerification.packagingGated === true &&
      includedDestinations.has("evidence/public-beta-return-intake-verification.json") &&
      packetFileExists("evidence/public-beta-return-intake-verification.json", 100),
    `status=${returnIntakeVerification?.status ?? "missing"}; checks=${
      returnIntakeVerification?.passed ?? "?"
    }/${returnIntakeVerification?.total ?? "?"}; packaged=${packetFileExists(
      "evidence/public-beta-return-intake-verification.json",
      100
    )}`
  );

  const feedbackValidationExists = fileExistsWithSize(
    "artifacts/productization/public-beta-feedback-receipt-validation.json",
    100
  );
  push(
    checks,
    "Public beta feedback validation evidence is packaged when present",
    !feedbackValidationExists ||
      (includedDestinations.has("evidence/public-beta-feedback-receipt-validation.json") &&
        packetFileExists("evidence/public-beta-feedback-receipt-validation.json", 100)),
    `rootEvidence=${feedbackValidationExists}; packaged=${packetFileExists(
      "evidence/public-beta-feedback-receipt-validation.json",
      100
    )}`
  );

  const feedbackCollectionExists = fileExistsWithSize(
    "artifacts/productization/public-beta-feedback-collection.json",
    100
  );
  push(
    checks,
    "Public beta feedback collection evidence is packaged when present",
    !feedbackCollectionExists ||
      (includedDestinations.has("evidence/public-beta-feedback-collection.json") &&
        packetFileExists("evidence/public-beta-feedback-collection.json", 100)),
    `rootEvidence=${feedbackCollectionExists}; packaged=${packetFileExists(
      "evidence/public-beta-feedback-collection.json",
      100
    )}`
  );

  push(
    checks,
    "Public beta returned receipts are routed through intake before queue collection",
    startHereText.includes("Do not hand-copy externally returned tester receipts") &&
      startHereText.includes("npm run intake:public-beta-return -- --receipt path/to/submitted-feedback.json --session-receipt path/to/filled-public-beta-session-receipt.json --send-receipt-validation artifacts/productization/first-real-tester-send-receipt-validation.json") &&
      startHereText.includes("same tester.name/tester.date") &&
      startHereText.includes("sessionEvidence.feedbackReceiptPath") &&
      productHandoffText.includes("Do not hand-copy externally returned tester receipts") &&
      productHandoffText.includes("npm run intake:public-beta-return -- --receipt <path> --session-receipt <session-receipt-path> --send-receipt-validation artifacts/productization/first-real-tester-send-receipt-validation.json") &&
      productHandoffText.includes("Use `npm run collect:public-beta-feedback` only to audit or refresh") &&
      !startHereText.includes("Place filled JSON receipts in `artifacts/productization/public-beta-feedback-inbox/`") &&
      !productHandoffText.includes("Store filled tester JSON receipts under") &&
      manifest?.betaCollectionTargets?.some((target) => target.includes("same tester.name/tester.date")) === true &&
      manifest?.betaCollectionTargets?.some((target) => target.includes("sessionEvidence.feedbackReceiptPath")) === true &&
      feedbackCollection?.nextAction?.includes("intake:public-beta-return") === true &&
      feedbackCollection.releaseDecision === "do_not_release" &&
      feedbackCollection.accepted === false &&
      feedbackCollection.packagingGated === true,
    `startHereIntake=${startHereText.includes("intake:public-beta-return")}; handoffIntake=${productHandoffText.includes(
      "intake:public-beta-return"
    )}; binding=${startHereText.includes("same tester.name/tester.date")}; collectionNextAction=${feedbackCollection?.nextAction ?? "missing"}`
  );

  const preparationExists = fileExistsWithSize("artifacts/productization/public-beta-preparation.json", 100);
  push(
    checks,
    "Public beta preparation evidence is packaged when present",
    !preparationExists ||
      (includedDestinations.has("evidence/public-beta-preparation.json") &&
        packetFileExists("evidence/public-beta-preparation.json", 100)),
    `rootEvidence=${preparationExists}; packaged=${packetFileExists(
      "evidence/public-beta-preparation.json",
      100
    )}`
  );

  const handoffBrowserSmokeExists = fileExistsWithSize("artifacts/productization/handoff-browser-smoke.json", 100);
  push(
    checks,
    "Handoff return-loop browser evidence is packaged when present",
    !handoffBrowserSmokeExists ||
      (handoffBrowserSmoke?.responseMode === "handoff_browser_smoke_receipt_json_v1" &&
        handoffBrowserSmoke.status === "passed" &&
        handoffBrowserSmoke.releaseDecision === "do_not_release" &&
        handoffBrowserSmoke.accepted === false &&
        handoffBrowserSmoke.packagingGated === true &&
        handoffBrowserSmoke.passed === handoffBrowserSmoke.total &&
        Number(handoffBrowserSmoke.total ?? 0) >= 3 &&
        handoffBrowserSmoke.captures?.some((capture) => capture.viewport === "desktop" && capture.pass === true) === true &&
        handoffBrowserSmoke.captures?.some((capture) => capture.viewport === "mobile" && capture.pass === true) === true &&
        includedDestinations.has("evidence/handoff-browser-smoke.json") &&
        includedDestinations.has("evidence/handoff-beta-feedback-desktop.png") &&
        includedDestinations.has("evidence/handoff-beta-feedback-mobile.png") &&
        packetFileExists("evidence/handoff-browser-smoke.json", 100) &&
        packetFileExists("evidence/handoff-beta-feedback-desktop.png", 10_000) &&
        packetFileExists("evidence/handoff-beta-feedback-mobile.png", 10_000)),
    `rootEvidence=${handoffBrowserSmokeExists}; status=${handoffBrowserSmoke?.status ?? "missing"}; packaged=${packetFileExists(
      "evidence/handoff-browser-smoke.json",
      100
    )}/${packetFileExists("evidence/handoff-beta-feedback-desktop.png", 10_000)}/${packetFileExists(
      "evidence/handoff-beta-feedback-mobile.png",
      10_000
    )}`
  );

  const publicBetaBrowserSmokeExists = fileExistsWithSize("artifacts/productization/public-beta-browser-smoke.json", 100);
  push(
    checks,
    "Public beta feedback workbench browser evidence is packaged when present",
    !publicBetaBrowserSmokeExists ||
      (publicBetaBrowserSmoke?.responseMode === "public_beta_browser_smoke_receipt_json_v1" &&
        publicBetaBrowserSmoke.status === "passed" &&
        publicBetaBrowserSmoke.releaseDecision === "do_not_release" &&
        publicBetaBrowserSmoke.reviewOnly === true &&
        publicBetaBrowserSmoke.accepted === false &&
        publicBetaBrowserSmoke.packagingGated === true &&
        publicBetaBrowserSmoke.passed === publicBetaBrowserSmoke.total &&
        Number(publicBetaBrowserSmoke.total ?? 0) >= 4 &&
        publicBetaBrowserSmoke.validation?.dryRunValidated === true &&
        publicBetaBrowserSmoke.validation.noInboxGrowth === true &&
        publicBetaBrowserSmoke.captures?.some(
          (capture) => capture.viewport === "desktop" && Number(capture.screenshotBytes ?? 0) > 10_000
        ) === true &&
        publicBetaBrowserSmoke.captures?.some(
          (capture) => capture.viewport === "mobile" && Number(capture.screenshotBytes ?? 0) > 10_000
        ) === true &&
        includedDestinations.has("evidence/public-beta-browser-smoke.json") &&
        includedDestinations.has("evidence/public-beta-browser-desktop.png") &&
        includedDestinations.has("evidence/public-beta-browser-mobile.png") &&
        packetFileExists("evidence/public-beta-browser-smoke.json", 1000) &&
        packetFileExists("evidence/public-beta-browser-desktop.png", 10_000) &&
        packetFileExists("evidence/public-beta-browser-mobile.png", 10_000)),
    `rootEvidence=${publicBetaBrowserSmokeExists}; status=${publicBetaBrowserSmoke?.status ?? "missing"}; packaged=${packetFileExists(
      "evidence/public-beta-browser-smoke.json",
      1000
    )}/${packetFileExists("evidence/public-beta-browser-desktop.png", 10_000)}/${packetFileExists(
      "evidence/public-beta-browser-mobile.png",
      10_000
    )}`
  );
  const manualBrowserSmokeExists = fileExistsWithSize("artifacts/productization/manual-acceptance-browser-smoke.json", 100);
  push(
    checks,
    "Manual acceptance browser evidence is packaged and not human acceptance",
    !manualBrowserSmokeExists ||
      (manualBrowserSmoke?.responseMode === "manual_acceptance_browser_smoke_receipt_json_v1" &&
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
        manualBrowserSmoke.captures?.some(
          (capture) => capture.viewport === "desktop" && capture.pass === true && Number(capture.screenshotBytes ?? 0) > 10_000
        ) === true &&
        manualBrowserSmoke.captures?.some(
          (capture) => capture.viewport === "mobile" && capture.pass === true && Number(capture.screenshotBytes ?? 0) > 10_000
        ) === true &&
        includedDestinations.has("evidence/manual-acceptance-browser-smoke.json") &&
        includedDestinations.has("evidence/manual-acceptance-browser-desktop.png") &&
        includedDestinations.has("evidence/manual-acceptance-browser-mobile.png") &&
        includedDestinations.has("evidence/manual-acceptance-report.browser-smoke.json") &&
        packetFileExists("evidence/manual-acceptance-browser-smoke.json", 1000) &&
        packetFileExists("evidence/manual-acceptance-browser-desktop.png", 10_000) &&
        packetFileExists("evidence/manual-acceptance-browser-mobile.png", 10_000) &&
        packetFileExists("evidence/manual-acceptance-report.browser-smoke.json", 1000)),
    `rootEvidence=${manualBrowserSmokeExists}; status=${manualBrowserSmoke?.status ?? "missing"}; evidenceKind=${
      manualBrowserSmoke?.evidenceKind ?? "missing"
    }; packaged=${packetFileExists("evidence/manual-acceptance-browser-smoke.json", 1000)}/${packetFileExists(
      "evidence/manual-acceptance-browser-desktop.png",
      10_000
    )}/${packetFileExists("evidence/manual-acceptance-browser-mobile.png", 10_000)}`
  );

  const preparationOutput = (packetPreparationReceipt?.steps ?? [])
    .map((step) => step.outputTail ?? "")
    .join("\n");
  const passedStepsWithOutput = (packetPreparationReceipt?.steps ?? []).filter(
    (step) => step.status === "passed" && (step.outputTail?.trim().length ?? 0) > 0
  );
  push(
    checks,
    "Public beta preparation receipt is compact and path-sanitized",
    !preparationExists ||
      (packetPreparationReceipt?.responseMode === "public_beta_preparation_receipt_json_v1" &&
        packetPreparationReceipt.releaseDecision === "do_not_release" &&
        packetPreparationReceipt.accepted === false &&
        packetPreparationReceipt.packagingGated === true &&
        passedStepsWithOutput.length === 0 &&
        !/[A-Z]:\\/.test(preparationOutput)),
    `status=${packetPreparationReceipt?.status ?? "missing"}; checks=${
      packetPreparationReceipt?.passed ?? "?"
    }/${packetPreparationReceipt?.total ?? "?"}; passedStepsWithOutput=${passedStepsWithOutput.length}; absolutePaths=${/[A-Z]:\\/.test(
      preparationOutput
    )}`
  );

  push(
    checks,
    "Live handoff evidence is current enough for beta",
    liveHandoff?.status === "passed" &&
      liveHandoff.releaseDecision === "do_not_release" &&
      liveHandoff.runtimeNames?.includes("standalone") === true &&
      liveHandoff.verificationRuntimeNames?.length === 0 &&
      liveHandoff.passed === liveHandoff.total &&
      Number(liveHandoff.total ?? 0) >= 9,
    `status=${liveHandoff?.status ?? "missing"}; runtimeNames=${
      liveHandoff?.runtimeNames?.join(",") ?? "missing"
    }; verificationRuntimeNames=${liveHandoff?.verificationRuntimeNames?.join(",") ?? "missing"}; checks=${
      liveHandoff?.passed ?? "?"
    }/${liveHandoff?.total ?? "?"}`
  );

  push(
    checks,
    "Handoff and release receipts match beta boundary",
    handoff?.status === "passed" &&
      handoff.passed === handoff.total &&
      Number(handoff.total ?? 0) >= 23 &&
      releaseReadiness?.status === "blocked_not_release_ready" &&
      releaseReadiness.releaseDecision === "do_not_release" &&
      releaseReadiness.boundary?.accepted === false &&
      releaseReadiness.boundary.packagingGated === true &&
      releaseReadiness.blockers?.some((blocker) => blocker.name === "Real human acceptance is complete") === true,
    `handoff=${handoff?.status ?? "missing"} ${handoff?.passed ?? "?"}/${handoff?.total ?? "?"}; release=${
      releaseReadiness?.status ?? "missing"
    }; decision=${releaseReadiness?.releaseDecision ?? "missing"}; blockers=${releaseReadiness?.blockers?.length ?? "?"}`
  );

  push(
    checks,
    "Beta collection targets request real tester evidence",
    manifest?.betaCollectionTargets?.some((target) => target.includes("/public-beta")) === true &&
      manifest.betaCollectionTargets.some((target) => target.includes("human_review")) &&
      manifest.betaCollectionTargets.some((target) => target.includes("release readiness blocked")) &&
      manifest.betaCollectionTargets.some((target) => target.includes("human-acceptance-reviewer-kit")) &&
      manifest.betaCollectionTargets.some((target) => target.includes("human-acceptance-reviewer-invite")) &&
      manifest.betaCollectionTargets.some((target) => target.includes("HUMAN_ACCEPTANCE_RECEIPT")) &&
      manifest.betaCollectionTargets.some((target) => target.includes("intake:human-acceptance-return")) &&
      manifest.betaCollectionTargets.some((target) => target.includes("verify:human-acceptance-return-intake")) &&
      manifest.betaCollectionTargets.some((target) => target.includes("postIntakeRefresh.commandSequence")) &&
      manifest.betaCollectionTargets.some((target) => target.includes("PRODUCTIZATION_LAUNCH_CHECKLIST")) &&
      manifest.betaCollectionTargets.some((target) => target.includes("controlled launch checklist")) &&
      manifest.betaCollectionTargets.some((target) => target.includes("PRODUCT_OPERATOR_BRIEF")) &&
      manifest.betaCollectionTargets.some((target) => target.includes("PRODUCT_RELEASE_BLOCKER_BOARD")) &&
      manifest.betaCollectionTargets.some((target) => target.includes("PRODUCT_RELEASE_APPROVAL")) &&
      manifest.betaCollectionTargets.some((target) => target.includes("REAL_MODEL_TRIAL_KIT")) &&
      manifest.betaCollectionTargets.some((target) => target.includes("REAL_MODEL_TRIAL_RECEIPT")) &&
      manifest.betaCollectionTargets.some((target) => target.includes("verify:real-model-trial-return-intake")) &&
      manifest.betaCollectionTargets.some((target) => target.includes("plan:public-beta-follow-up")) &&
      manifest.betaCollectionTargets.some((target) => target.includes("PUBLIC_BETA_TESTER_RUNBOOK")) &&
      manifest.betaCollectionTargets.some((target) => target.includes("PUBLIC_BETA_TESTER_INVITE")) &&
      manifest.betaCollectionTargets.some((target) => target.includes("PUBLIC_BETA_SESSION_PLAN")) &&
      manifest.betaCollectionTargets.some((target) => target.includes("PUBLIC_BETA_SESSION_RECEIPT")) &&
      manifest.betaCollectionTargets.some((target) => target.includes("intake:public-beta-return")) &&
      manifest.betaCollectionTargets.some((target) => target.includes("verify:product-release-approval-return-intake")),
    `targets=${manifest?.betaCollectionTargets?.length ?? 0}`
  );

  const passed = checks.filter((check) => check.pass).length;
  const receipt = {
    responseMode: "public_beta_readiness_receipt_json_v1",
    status: passed === checks.length ? "passed" : "failed",
    generatedAt: new Date().toISOString(),
    command: "npm run verify:public-beta",
    packetDir: "artifacts/productization/public-beta-packet",
    releaseDecision: "do_not_release",
    productScope: "bounded_core_teaching_loop",
    allSoftwareObjective: "paused",
    reviewOnly: true,
    accepted: false,
    packagingGated: true,
    canRelease: false,
    canActivateRealModel: false,
    betaCanStart: passed === checks.length,
    packetEvidenceSynchronized: passed === checks.length,
    passed,
    total: checks.length,
    checks,
    nextAction:
      passed === checks.length
        ? "Run the live tester preflight, then invite a bounded beta tester using artifacts/productization/public-beta-packet/START_PUBLIC_BETA.md."
        : "Fix failed beta readiness checks, rebuild with npm run package:public-beta, then rerun npm run verify:public-beta."
  };

  fs.mkdirSync(artifactsDir, { recursive: true });
  const receiptJson = JSON.stringify(receipt, null, 2);
  fs.writeFileSync(receiptPath, receiptJson);
  if (receipt.status === "passed") {
    syncPacketReadinessEvidence(receiptJson);
  }
  console.log(JSON.stringify(receipt, null, 2));
  console.log(`\nPublic beta readiness receipt written to ${receiptPath}`);

  if (receipt.status !== "passed") {
    process.exitCode = 1;
  }
}

main();

export {};


