import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

type VerificationCheck = {
  name: string;
  pass: boolean;
  evidence: string;
};

type IncludedFile = {
  source?: string;
  destination?: string;
  required?: boolean;
  bytes?: number;
};

const rootDir = process.cwd();
const artifactsDir = path.join(rootDir, "artifacts", "productization");
const packetDir = path.join(artifactsDir, "product-trial-packet");
const manifestPath = path.join(packetDir, "product-trial-manifest.json");
const receiptPath = path.join(artifactsDir, "product-trial-packet-verification.json");
const packetReceiptDestination = "evidence/product-trial-packet-verification.json";

function push(checks: VerificationCheck[], name: string, pass: boolean, evidence: string) {
  checks.push({ name, pass, evidence });
}

function readJson<T>(relativePath: string): T | null {
  try {
    return JSON.parse(fs.readFileSync(path.join(rootDir, relativePath), "utf8")) as T;
  } catch {
    return null;
  }
}

function readPacketJson<T>(destination: string): T | null {
  try {
    return JSON.parse(fs.readFileSync(path.join(packetDir, destination), "utf8")) as T;
  } catch {
    return null;
  }
}

function fileExistsWithSize(fullPath: string, minimumBytes = 1) {
  return fs.existsSync(fullPath) && fs.statSync(fullPath).size >= minimumBytes;
}

function packetFileExists(destination: string, minimumBytes = 1) {
  return fileExistsWithSize(path.join(packetDir, destination), minimumBytes);
}

const coreHandoffDocs = [
  { source: "README.md", destination: "docs/README.md" },
  { source: "PRODUCT_HANDOFF.md", destination: "docs/PRODUCT_HANDOFF.md" },
  { source: "PRODUCTIZATION_FOCUS.md", destination: "docs/PRODUCTIZATION_FOCUS.md" }
];

function packetTextMatchesRoot(source: string, destination: string) {
  const sourcePath = path.join(rootDir, source);
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

function commandBefore(commands: string[] | undefined, first: string, second: string) {
  const firstIndex = commands?.findIndex((command) => command.startsWith(first)) ?? -1;
  const secondIndex = commands?.indexOf(second) ?? -1;
  return firstIndex >= 0 && secondIndex > firstIndex;
}

function stepIndex(steps: string[] | undefined, needle: string) {
  return steps?.findIndex((step) => step.includes(needle)) ?? -1;
}

function upsertManifestIncludedFile(destination: string, source: string, bytes: number) {
  const manifest = readJson<{
    includedFiles?: IncludedFile[];
  }>("artifacts/productization/product-trial-packet/product-trial-manifest.json");
  if (!manifest) return;

  manifest.includedFiles = manifest.includedFiles ?? [];
  const existing = manifest.includedFiles.find((file) => file.destination === destination);
  if (existing) {
    existing.source = source;
    existing.bytes = bytes;
    existing.required = false;
  } else {
    manifest.includedFiles.push({ source, destination, bytes, required: false });
  }

  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
}

function embedReceipt(receiptJson: string) {
  fs.mkdirSync(artifactsDir, { recursive: true });
  fs.writeFileSync(receiptPath, `${receiptJson}\n`, "utf8");

  const packetReceiptPath = path.join(packetDir, packetReceiptDestination);
  fs.mkdirSync(path.dirname(packetReceiptPath), { recursive: true });
  fs.writeFileSync(packetReceiptPath, `${receiptJson}\n`, "utf8");
  upsertManifestIncludedFile(
    packetReceiptDestination,
    "artifacts/productization/product-trial-packet-verification.json",
    fs.statSync(packetReceiptPath).size
  );
}

export function verifyProductTrialPacket(options: { log?: boolean } = {}) {
  const checks: VerificationCheck[] = [];
  const manifest = readJson<{
    responseMode?: string;
    status?: string;
    generatedAt?: string;
    packetDir?: string;
    productScope?: string;
    allSoftwareObjective?: string;
    packagingBoundary?: { accepted?: boolean; packagingGated?: boolean; status?: string };
    commands?: string[];
    includedFiles?: IncludedFile[];
    nextHumanSteps?: string[];
  }>("artifacts/productization/product-trial-packet/product-trial-manifest.json");

  const includedDestinations = new Set((manifest?.includedFiles ?? []).map((file) => file.destination));
  const startHere = fs.existsSync(path.join(packetDir, "START_HERE.md"))
    ? fs.readFileSync(path.join(packetDir, "START_HERE.md"), "utf8")
    : "";

  const packetTakeoverMatrixText = readPacketText("docs/PRODUCT_TAKEOVER_DECISION_MATRIX.md");
  const packetLaunchChecklistText = readPacketText("docs/PRODUCTIZATION_LAUNCH_CHECKLIST.md");

  const productVerification = readPacketJson<{ responseMode?: string; status?: string; passed?: number; total?: number }>(
    "evidence/product-verification-receipt.json"
  );
  const productUiApiSmoke = readPacketJson<{
    responseMode?: string;
    status?: string;
    passed?: number;
    total?: number;
    releaseDecision?: string;
    accepted?: boolean;
    packagingGated?: boolean;
  }>("evidence/product-ui-api-smoke.json");
  const productRuntimeVerification = readPacketJson<{ status?: string; passed?: number; total?: number }>(
    "evidence/product-runtime-verification.json"
  );
  const productRuntimeDoctor = readPacketJson<{ status?: string; passed?: number; total?: number }>(
    "evidence/product-runtime-doctor.json"
  );
  const releaseReadiness = readPacketJson<{
    responseMode?: string;
    status?: string;
    releaseDecision?: string;
    blockers?: Array<{ name?: string }>;
    boundary?: { accepted?: boolean; packagingGated?: boolean; activeProvider?: string };
  }>("evidence/product-release-readiness.json");
  const productizationEvidenceFreshness = readPacketJson<{
    responseMode?: string;
    status?: string;
    generatedAt?: string;
    releaseDecision?: string;
    allSoftwareObjective?: string;
    accepted?: boolean;
    packagingGated?: boolean;
    canRelease?: boolean;
    passed?: number;
    total?: number;
  }>("evidence/productization-evidence-freshness.json");
  const productStatusSummary = readPacketJson<{
    responseMode?: string;
    status?: string;
    betaCanStart?: boolean;
    canRelease?: boolean;
    canActivateRealModel?: boolean;
    releaseDecision?: string;
    allSoftwareObjective?: string;
    accepted?: boolean;
    packagingGated?: boolean;
  }>("evidence/product-status-summary.json");
  const productizationLaunchChecklist = readPacketJson<{
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
  }>("evidence/productization-launch-checklist.json");
  const productizationLaunchChecklistVerification = readPacketJson<{
    responseMode?: string;
    status?: string;
    releaseDecision?: string;
    accepted?: boolean;
    packagingGated?: boolean;
    canRelease?: boolean;
    canActivateRealModel?: boolean;
    passed?: number;
    total?: number;
  }>("evidence/productization-launch-checklist-verification.json");
  const operatorBrief = readPacketJson<{
    responseMode?: string;
    status?: string;
    canInviteBoundedBetaTester?: boolean;
    canRelease?: boolean;
    canActivateRealModel?: boolean;
    releaseDecision?: string;
    accepted?: boolean;
    packagingGated?: boolean;
  }>("evidence/product-operator-brief.json");
  const releaseBlockerBoard = readPacketJson<{
    responseMode?: string;
    status?: string;
    canRelease?: boolean;
    releaseDecision?: string;
    accepted?: boolean;
    packagingGated?: boolean;
    lanes?: unknown[];
  }>("evidence/product-release-blocker-board.json");
  const humanAcceptanceGate = readPacketJson<{
    status?: string;
    evidenceKind?: string;
    humanReviewed?: boolean;
    latestEvidenceKind?: string;
    latestHumanReviewed?: boolean;
    accepted?: boolean;
    packagingGated?: boolean;
    releaseBoundary?: { accepted?: boolean; packagingGated?: boolean };
  }>("evidence/human-acceptance-gate.json");
  const realModelAdapterContract = readPacketJson<{
    responseMode?: string;
    status?: string;
    realNetworkUsed?: boolean;
    realProviderAccepted?: boolean;
    canActivateRealModel?: boolean;
    canRelease?: boolean;
    releaseDecision?: string;
    accepted?: boolean;
    packagingGated?: boolean;
    passed?: number;
    total?: number;
  }>("evidence/real-model-adapter-contract-verification.json");
  const publicBetaReadiness = readPacketJson<{
    responseMode?: string;
    status?: string;
    betaCanStart?: boolean;
    releaseDecision?: string;
    packetEvidenceSynchronized?: boolean;
    passed?: number;
    total?: number;
  }>("evidence/public-beta-readiness.json");
  const takeoverEntryConsistency = readPacketJson<{
    responseMode?: string;
    status?: string;
    releaseDecision?: string;
    allSoftwareObjective?: string;
    accepted?: boolean;
    packagingGated?: boolean;
    canRelease?: boolean;
    passed?: number;
    total?: number;
  }>("evidence/product-takeover-entry-consistency.json");
  const rootTesterSessionPreflight = readJson<{
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
  const packetTesterSessionPreflight = readPacketJson<{
    responseMode?: string;
    status?: string;
    canInviteTester?: boolean;
    generatedAt?: string;
    passed?: number;
    total?: number;
    releaseDecision?: string;
    accepted?: boolean;
    packagingGated?: boolean;
  }>("evidence/public-beta-tester-session-preflight.json");

  push(
    checks,
    "Product trial packet manifest exists",
    manifest?.responseMode === "product_trial_packet_manifest_json_v1" &&
      manifest.status === "built" &&
      manifest.packetDir === "artifacts/productization/product-trial-packet" &&
      fileExistsWithSize(manifestPath, 1000),
    `status=${manifest?.status ?? "missing"}; packetDir=${manifest?.packetDir ?? "missing"}`
  );

  push(
    checks,
    "Product trial packet remains review-only and bounded",
    manifest?.productScope === "bounded_core_teaching_loop" &&
      manifest.allSoftwareObjective === "paused" &&
      manifest.packagingBoundary?.accepted === false &&
      manifest.packagingBoundary.packagingGated === true &&
      manifest.packagingBoundary.status === "pending_teacher_acceptance",
    `scope=${manifest?.productScope ?? "missing"}; allSoftware=${manifest?.allSoftwareObjective ?? "missing"}; accepted=${
      manifest?.packagingBoundary?.accepted ?? "missing"
    }; packagingGated=${manifest?.packagingBoundary?.packagingGated ?? "missing"}`
  );

  const missingIncludedFiles = (manifest?.includedFiles ?? []).filter((file) => {
    if (!file.destination || file.destination === packetReceiptDestination) return false;
    return !packetFileExists(file.destination, 1);
  });
  push(
    checks,
    "Manifest included files exist in the packet",
    (manifest?.includedFiles?.length ?? 0) >= 55 && missingIncludedFiles.length === 0,
    `files=${manifest?.includedFiles?.length ?? 0}; missing=${missingIncludedFiles
      .slice(0, 5)
      .map((file) => file.destination)
      .join(",") || "none"}`
  );

  const requiredFiles = [
    "START_HERE.md",
    "docs/README.md",
    "docs/PRODUCT_HANDOFF.md",
    "docs/PRODUCTIZATION_FOCUS.md",
    "docs/.env.example",
    "evidence/product-verification-receipt.json",
    "evidence/product-ui-api-smoke.json",
    "evidence/product-runtime-verification.json",
    "evidence/product-runtime-doctor.json",
    "evidence/product-release-readiness.json",
    "evidence/product-handoff-readiness.json",
    "evidence/human-acceptance-gate.json",
    "evidence/manual-acceptance-classification-verification.json",
    "evidence/manual-acceptance-latest.json",
    "evidence/smoke-record-cleanup.json",
    "evidence/runtime-artifact-cleanup.json",
    "evidence/product-takeover-entry-consistency.json"
  ];
  const missingRequiredFiles = requiredFiles.filter((file) => !packetFileExists(file, 100));
  push(
    checks,
    "Required trial handoff files are present",
    missingRequiredFiles.length === 0,
    `missing=${missingRequiredFiles.join(",") || "none"}`
  );

  push(
    checks,
    "Core trial handoff docs match root docs",
    coreHandoffDocsMatchRoot(),
    coreHandoffDocSyncEvidence()
  );

  push(
    checks,
    "Trial README documents post-package delivery index boundary",
    readmeDocumentsPostPackageDeliveryIndex(),
    `postPackage=${readPacketText("docs/README.md").includes("post-package outer delivery index")}; afterVerify=${readPacketText(
      "docs/README.md"
    ).includes("after `npm run verify:github-source` passes")}; rebuild=${readPacketText("docs/README.md").includes(
      "rebuild it after every refreshed source zip"
    )}`
  );
  push(
    checks,
    "Core product verification receipts are green",
    productVerification?.status === "passed" &&
      productVerification.passed === productVerification.total &&
      productUiApiSmoke?.status === "passed" &&
      productUiApiSmoke.passed === productUiApiSmoke.total &&
      productUiApiSmoke.releaseDecision === "do_not_release" &&
      productUiApiSmoke.accepted === false &&
      productUiApiSmoke.packagingGated === true &&
      productRuntimeVerification?.status === "passed" &&
      productRuntimeVerification.passed === productRuntimeVerification.total &&
      productRuntimeDoctor?.status === "passed" &&
      productRuntimeDoctor.passed === productRuntimeDoctor.total,
    `product=${productVerification?.status ?? "missing"} ${productVerification?.passed ?? "?"}/${
      productVerification?.total ?? "?"
    }; uiApi=${productUiApiSmoke?.status ?? "missing"} ${productUiApiSmoke?.passed ?? "?"}/${
      productUiApiSmoke?.total ?? "?"
    }; runtime=${productRuntimeVerification?.status ?? "missing"}; doctor=${productRuntimeDoctor?.status ?? "missing"}`
  );

  push(
    checks,
    "Release remains explicitly blocked",
    releaseReadiness?.responseMode === "product_release_readiness_gate_json_v1" &&
      releaseReadiness.status === "blocked_not_release_ready" &&
      releaseReadiness.releaseDecision === "do_not_release" &&
      releaseReadiness.boundary?.accepted === false &&
      releaseReadiness.boundary.packagingGated === true &&
      releaseReadiness.blockers?.some((blocker) => blocker.name === "Real human acceptance is complete") === true &&
      releaseReadiness.blockers.some((blocker) => blocker.name === "Real model adapter is ready") &&
      releaseReadiness.blockers.some((blocker) => blocker.name === "Packaging and release lock is intentionally still closed"),
    `status=${releaseReadiness?.status ?? "missing"}; release=${releaseReadiness?.releaseDecision ?? "missing"}; blockers=${
      releaseReadiness?.blockers?.length ?? "?"
    }`
  );

  push(
    checks,
    "Productization freshness evidence is packaged and green",
    productizationEvidenceFreshness?.responseMode === "productization_evidence_freshness_json_v1" &&
      productizationEvidenceFreshness.status === "passed" &&
      productizationEvidenceFreshness.passed === productizationEvidenceFreshness.total &&
      Number(productizationEvidenceFreshness.total ?? 0) >= 8 &&
      productizationEvidenceFreshness.releaseDecision === "do_not_release" &&
      productizationEvidenceFreshness.allSoftwareObjective === "paused" &&
      productizationEvidenceFreshness.accepted === false &&
      productizationEvidenceFreshness.packagingGated === true &&
      productizationEvidenceFreshness.canRelease === false &&
      includedDestinations.has("evidence/productization-evidence-freshness.json"),
    `status=${productizationEvidenceFreshness?.status ?? "missing"}; checks=${
      productizationEvidenceFreshness?.passed ?? "?"
    }/${productizationEvidenceFreshness?.total ?? "?"}; packaged=${includedDestinations.has(
      "evidence/productization-evidence-freshness.json"
    )}`
  );
  push(
    checks,
    "Productization launch checklist is packaged, green, and locked",
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
      includedDestinations.has("evidence/productization-launch-checklist-verification.json") &&
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
    "Product trial packet preserves real-model redaction in first-read handoff docs",
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
    }; packaged=${includedDestinations.has("evidence/product-takeover-entry-consistency.json")}`
  );

  push(
    checks,
    "Operator status docs preserve beta-not-release boundary",
    productStatusSummary?.responseMode === "product_status_summary_json_v1" &&
      productStatusSummary.status === "ready_for_bounded_beta_not_release" &&
      productStatusSummary.betaCanStart === true &&
      productStatusSummary.canRelease === false &&
      productStatusSummary.canActivateRealModel === false &&
      productStatusSummary.releaseDecision === "do_not_release" &&
      productStatusSummary.allSoftwareObjective === "paused" &&
      productStatusSummary.accepted === false &&
      productStatusSummary.packagingGated === true &&
      operatorBrief?.responseMode === "product_operator_brief_json_v1" &&
      operatorBrief.status === "ready_for_operator_handoff" &&
      operatorBrief.canInviteBoundedBetaTester === true &&
      operatorBrief.canRelease === false &&
      operatorBrief.canActivateRealModel === false &&
      releaseBlockerBoard?.responseMode === "product_release_blocker_board_json_v1" &&
      releaseBlockerBoard.status === "ready_for_blocker_resolution" &&
      releaseBlockerBoard.canRelease === false &&
      Number(releaseBlockerBoard.lanes?.length ?? 0) >= 3,
    `summary=${productStatusSummary?.status ?? "missing"}; operator=${operatorBrief?.status ?? "missing"}; blockerBoard=${
      releaseBlockerBoard?.status ?? "missing"
    } lanes=${releaseBlockerBoard?.lanes?.length ?? "?"}`
  );

  push(
    checks,
    "Human acceptance evidence is not confused with automated smoke",
    humanAcceptanceGate?.status === "blocked_needs_human_review" &&
      (humanAcceptanceGate.evidenceKind ?? humanAcceptanceGate.latestEvidenceKind) === "automated_browser_smoke" &&
      (humanAcceptanceGate.humanReviewed ?? humanAcceptanceGate.latestHumanReviewed) === false &&
      (humanAcceptanceGate.accepted ?? humanAcceptanceGate.releaseBoundary?.accepted) === false &&
      (humanAcceptanceGate.packagingGated ?? humanAcceptanceGate.releaseBoundary?.packagingGated) === true,
    `status=${humanAcceptanceGate?.status ?? "missing"}; evidenceKind=${
      humanAcceptanceGate?.evidenceKind ?? humanAcceptanceGate?.latestEvidenceKind ?? "missing"
    }; humanReviewed=${humanAcceptanceGate?.humanReviewed ?? humanAcceptanceGate?.latestHumanReviewed ?? "missing"}`
  );

  push(
    checks,
    "Real model remains locked behind mock provider",
    realModelAdapterContract?.responseMode === "real_model_adapter_contract_verification_json_v1" &&
      realModelAdapterContract.status === "passed" &&
      realModelAdapterContract.passed === realModelAdapterContract.total &&
      realModelAdapterContract.realNetworkUsed === false &&
      realModelAdapterContract.realProviderAccepted === false &&
      realModelAdapterContract.canActivateRealModel === false &&
      realModelAdapterContract.canRelease === false &&
      realModelAdapterContract.releaseDecision === "do_not_release" &&
      realModelAdapterContract.accepted === false &&
      realModelAdapterContract.packagingGated === true,
    `status=${realModelAdapterContract?.status ?? "missing"}; realNetwork=${realModelAdapterContract?.realNetworkUsed ?? "missing"}; canActivate=${
      realModelAdapterContract?.canActivateRealModel ?? "missing"
    }`
  );

  const rootTesterSessionPreflightExists = fileExistsWithSize(
    path.join(rootDir, "artifacts", "productization", "public-beta-tester-session-preflight.json"),
    100
  );
  const testerSessionPreflightFreshEnough =
    rootTesterSessionPreflightExists &&
    isAtOrAfterTimestamp(rootTesterSessionPreflight?.generatedAt, productizationEvidenceFreshness?.generatedAt);
  const testerSessionPreflightPackaged = packetFileExists("evidence/public-beta-tester-session-preflight.json", 100);
  const testerSessionPreflightValid =
    packetTesterSessionPreflight?.responseMode === "public_beta_tester_session_preflight_json_v1" &&
    packetTesterSessionPreflight.status === "passed" &&
    packetTesterSessionPreflight.canInviteTester === true &&
    packetTesterSessionPreflight.passed === packetTesterSessionPreflight.total &&
    Number(packetTesterSessionPreflight.total ?? 0) >= 10 &&
    packetTesterSessionPreflight.releaseDecision === "do_not_release" &&
    packetTesterSessionPreflight.accepted === false &&
    packetTesterSessionPreflight.packagingGated === true;
  push(
    checks,
    "Tester session preflight packaging matches freshness",
    !rootTesterSessionPreflightExists ||
      (!testerSessionPreflightFreshEnough && !testerSessionPreflightPackaged) ||
      (testerSessionPreflightFreshEnough && testerSessionPreflightPackaged && testerSessionPreflightValid),
    `rootEvidence=${rootTesterSessionPreflightExists}; freshEnough=${testerSessionPreflightFreshEnough}; packaged=${testerSessionPreflightPackaged}; status=${
      packetTesterSessionPreflight?.status ?? rootTesterSessionPreflight?.status ?? "missing"
    }; checks=${packetTesterSessionPreflight?.passed ?? rootTesterSessionPreflight?.passed ?? "?"}/${
      packetTesterSessionPreflight?.total ?? rootTesterSessionPreflight?.total ?? "?"
    }`
  );

  const publicBetaEvidenceExists = packetFileExists("evidence/public-beta-readiness.json", 100);
  const publicBetaEvidencePreservesBoundary =
    publicBetaReadiness?.responseMode === "public_beta_readiness_receipt_json_v1" &&
    publicBetaReadiness.releaseDecision === "do_not_release" &&
    Number(publicBetaReadiness.total ?? 0) >= 45 &&
    ((publicBetaReadiness.status === "passed" &&
      publicBetaReadiness.betaCanStart === true &&
      publicBetaReadiness.packetEvidenceSynchronized === true &&
      publicBetaReadiness.passed === publicBetaReadiness.total) ||
      (publicBetaReadiness.status === "failed" &&
        publicBetaReadiness.betaCanStart === false &&
        Number(publicBetaReadiness.passed ?? 0) < Number(publicBetaReadiness.total ?? 0)));
  push(
    checks,
    "Public beta evidence is bounded when packaged",
    !publicBetaEvidenceExists || publicBetaEvidencePreservesBoundary,
    `exists=${publicBetaEvidenceExists}; status=${publicBetaReadiness?.status ?? "missing"}; checks=${publicBetaReadiness?.passed ?? "?"}/${
      publicBetaReadiness?.total ?? "?"
    }; betaCanStart=${publicBetaReadiness?.betaCanStart ?? "missing"}; release=${publicBetaReadiness?.releaseDecision ?? "missing"}`
  );

  push(
    checks,
    "Trial packet embeds current first-real tester send handoff order",
    firstRealTesterSendHandoffOrderIsCurrent(packetTakeoverMatrixText),
    `sendOrderCurrent=${firstRealTesterSendHandoffOrderIsCurrent(packetTakeoverMatrixText)}; contact=${packetTakeoverMatrixText.includes("first-real-tester-contact-readiness.md")}; execution=${packetTakeoverMatrixText.includes("first-real-tester-send-execution-brief.md")}; finalGoNoGo=${packetTakeoverMatrixText.includes("first-real-tester-final-go-no-go.md")}`
  );
  push(
    checks,
    "Trial entrypoint documents current boundaries",
    startHere.includes("Transparent AI Apprentice Product Trial Packet") &&
      startHere.includes("evidence/productization-evidence-freshness.json") &&
      startHere.includes("docs/PRODUCT_TAKEOVER_DECISION_MATRIX.md") &&
      startHere.includes("docs/PRODUCTIZATION_LAUNCH_CHECKLIST.md") &&
      startHere.includes("docs/PRODUCT_STATUS_SUMMARY.md") &&
      startHere.includes("evidence/public-beta-tester-session-preflight.json") &&
      startHere.includes("when generated after the latest freshness receipt") &&
      startHere.includes("not release acceptance") &&
      startHere.includes("accepted=false") &&
      startHere.includes("packagingGated=true") &&
      startHere.includes("all-software objective paused"),
    `startHere=${Boolean(startHere)}; freshness=${startHere.includes("productization-evidence-freshness")}; boundary=${startHere.includes(
      "not release acceptance"
    )}`
  );

  const takeoverStep = stepIndex(manifest?.nextHumanSteps, "PRODUCT_TAKEOVER_DECISION_MATRIX.md first");
  const launchStep = stepIndex(manifest?.nextHumanSteps, "PRODUCTIZATION_LAUNCH_CHECKLIST.md");
  const statusStep = stepIndex(manifest?.nextHumanSteps, "PRODUCT_STATUS_SUMMARY.md");

  push(
    checks,
    "Trial commands expose follow-up gates",
    manifest?.commands?.includes("npm run verify:productization-evidence-freshness") === true &&
      manifest.commands.includes("npm run build:product-takeover-matrix") &&
      manifest.commands.includes("npm run verify:product-takeover-matrix") &&
      manifest.commands.includes("npm run build:productization-launch-checklist") &&
      manifest.commands.includes("npm run verify:productization-launch-checklist") &&
      commandBefore(manifest.commands, "npm run build:product-takeover-matrix", "npm run verify:product-takeover-matrix") &&
      commandBefore(manifest.commands, "npm run build:productization-launch-checklist", "npm run verify:productization-launch-checklist") &&
      commandBefore(manifest.commands, "npm run build:product-takeover-matrix", "npm run build:productization-launch-checklist") &&
      commandBefore(manifest.commands, "npm run build:productization-launch-checklist", "npm run build:product-status-summary") &&
      manifest.commands.includes("npm run verify:public-beta") &&
      manifest.commands.includes("npm run preflight:public-beta-tester -- --base-url http://127.0.0.1:3000") &&
      manifest.commands.includes("npm run verify:product-release-readiness") &&
      manifest.commands.includes("npm run verify:real-model-adapter-contract") &&
      commandBefore(
        manifest.commands,
        "npm run intake:human-acceptance-return",
        "npm run verify:human-acceptance-return-intake"
      ) &&
      commandBefore(
        manifest.commands,
        "npm run intake:real-model-trial-return",
        "npm run verify:real-model-trial-return-intake"
      ) &&
      commandBefore(
        manifest.commands,
        "npm run intake:product-release-approval-return",
        "npm run verify:product-release-approval-return-intake"
      ) &&
      takeoverStep >= 0 &&
      launchStep > takeoverStep &&
      statusStep > launchStep &&
      takeoverStep >= 0 &&
      launchStep > takeoverStep &&
      statusStep > launchStep &&
      manifest.nextHumanSteps?.some((step) => step.includes("postIntakeRefresh.commandSequence")) === true &&
      manifest.nextHumanSteps?.some((step) => step.includes("verify:human-acceptance-return-intake")) === true &&
      manifest.nextHumanSteps?.some((step) =>
        step.includes("npm run intake:public-beta-return -- --receipt <path> --session-receipt <session-receipt-path> --send-receipt-validation artifacts/productization/first-real-tester-send-receipt-validation.json")
      ) === true &&
      manifest.nextHumanSteps?.some((step) => step.includes("Do not resume the all-software objective")) === true,
    `commands=${manifest?.commands?.length ?? 0}; nextHumanSteps=${manifest?.nextHumanSteps?.length ?? 0}; firstRead=${takeoverStep}>${launchStep}>${statusStep}`
  );

  const passed = checks.filter((check) => check.pass).length;
  const receipt = {
    responseMode: "product_trial_packet_verification_json_v1",
    status: passed === checks.length ? "passed" : "failed",
    generatedAt: new Date().toISOString(),
    command: "npm run verify:product-trial",
    packetDir: "artifacts/productization/product-trial-packet",
    productScope: "bounded_core_teaching_loop",
    releaseDecision: "do_not_release",
    allSoftwareObjective: "paused",
    reviewOnly: true,
    accepted: false,
    packagingGated: true,
    canRelease: false,
    canActivateRealModel: false,
    passed,
    total: checks.length,
    checks,
    embeddedInPacket: passed === checks.length,
    nextAction:
      passed === checks.length
        ? "Use the verified product trial packet for bounded review handoff; keep release locked until human, model, and release approval evidence exists."
        : "Fix failed product trial packet checks, rerun npm run package:product-trial, then rerun npm run verify:product-trial."
  };

  const receiptJson = JSON.stringify(receipt, null, 2);
  if (receipt.status === "passed") {
    embedReceipt(receiptJson);
  } else {
    fs.mkdirSync(artifactsDir, { recursive: true });
    fs.writeFileSync(receiptPath, `${receiptJson}\n`, "utf8");
  }

  if (options.log !== false) {
    console.log(receiptJson);
    console.log(`\nProduct trial packet verification written to ${receiptPath}`);
  }

  return receipt;
}

const currentFile = fileURLToPath(import.meta.url);
if (path.resolve(process.argv[1] ?? "") === currentFile) {
  const receipt = verifyProductTrialPacket();
  if (receipt.status !== "passed") {
    process.exitCode = 1;
  }
}
