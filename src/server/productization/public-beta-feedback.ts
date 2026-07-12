import fs from "node:fs";
import path from "node:path";

export const productArtifactsDir =
  process.env.PRODUCT_ARTIFACTS_DIR ?? path.join(process.cwd(), "artifacts", "productization");
export const publicBetaFeedbackInboxDir = path.join(productArtifactsDir, "public-beta-feedback-inbox");
export const publicBetaFeedbackHistoryDir = path.join(productArtifactsDir, "public-beta-feedback-history");

export const publicBetaFeedbackAllowedDecisions = [
  "ready_for_next_beta_tester",
  "needs_fix_before_more_testers",
  "blocked"
] as const;

export type PublicBetaFeedbackDecision = (typeof publicBetaFeedbackAllowedDecisions)[number];

export type PublicBetaFeedbackReceipt = {
  responseMode?: string;
  status?: string;
  productScope?: string;
  allSoftwareObjective?: string;
  releaseDecision?: string;
  betaDecisionAllowedValues?: string[];
  defaultBetaDecision?: string;
  reviewOnly?: boolean;
  accepted?: boolean;
  packagingGated?: boolean;
  tester?: {
    name?: string;
    role?: string;
    date?: string;
    environment?: string;
  };
  setup?: {
    couldStartProductRuntime?: boolean | null;
    healthEndpointHealthy?: boolean | null;
    liveHandoffChecked?: boolean | null;
    notes?: string;
  };
  coreLoop?: {
    firstRunClear?: boolean | null;
    traceUnderstandable?: boolean | null;
    correctionSubmitted?: boolean | null;
    ruleProvenanceVisible?: boolean | null;
    rerunChangedBehavior?: boolean | null;
    notes?: string;
  };
  trustAndBoundaries?: {
    learnedBehaviorClear?: boolean | null;
    reviewOnlyBoundaryClear?: boolean | null;
    noReleaseOrAllSoftwareClaim?: boolean | null;
    notes?: string;
  };
  blockers?: {
    blockingIssue?: string;
    confusingWording?: string;
    missingProductBehavior?: string;
    screenshotOrEvidencePath?: string;
  };
  betaDecision?: string;
  nextActionRecommendation?: string;
  locks?: {
    mustNotSaveAcceptance?: boolean;
    mustNotEnableRules?: boolean;
    mustNotUnlockPackaging?: boolean;
    mustNotClaimReleaseReady?: boolean;
    mustNotResumeAllSoftwareObjective?: boolean;
  };
};

export type PublicBetaFeedbackValidation = {
  valid: boolean;
  failedChecks: string[];
};

export function buildPublicBetaFeedbackTemplate(overrides: Partial<PublicBetaFeedbackReceipt> = {}) {
  return {
    responseMode: "public_beta_feedback_receipt_template_json_v1",
    status: "submitted",
    productScope: "bounded_core_teaching_loop",
    allSoftwareObjective: "paused",
    releaseDecision: "do_not_release",
    betaDecisionAllowedValues: [...publicBetaFeedbackAllowedDecisions],
    defaultBetaDecision: "needs_fix_before_more_testers",
    reviewOnly: true,
    accepted: false,
    packagingGated: true,
    tester: {
      name: "",
      role: "",
      date: new Date().toISOString().slice(0, 10),
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
      noReleaseOrAllSoftwareClaim: true,
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
    },
    ...overrides
  } satisfies PublicBetaFeedbackReceipt;
}

function hasText(value: unknown) {
  return typeof value === "string" && value.trim().length > 0;
}

function isBoolean(value: unknown) {
  return typeof value === "boolean";
}

function safeName(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

function relativeArtifactPath(targetPath: string) {
  const resolvedTarget = path.resolve(targetPath);
  const resolvedArtifactsDir = path.resolve(productArtifactsDir);

  if (resolvedTarget === resolvedArtifactsDir || resolvedTarget.startsWith(`${resolvedArtifactsDir}${path.sep}`)) {
    return path
      .join("artifacts", "productization", path.relative(resolvedArtifactsDir, resolvedTarget))
      .replaceAll("\\", "/");
  }

  return path.relative(process.cwd(), resolvedTarget).replaceAll("\\", "/");
}

export function validatePublicBetaFeedbackReceipt(
  receipt: PublicBetaFeedbackReceipt | null
): PublicBetaFeedbackValidation {
  const failedChecks: string[] = [];

  if (!receipt) {
    return { valid: false, failedChecks: ["receipt_json_parseable"] };
  }

  if (receipt.responseMode !== "public_beta_feedback_receipt_template_json_v1") {
    failedChecks.push("response_mode");
  }
  if (
    receipt.status !== "submitted" ||
    !hasText(receipt.tester?.name) ||
    !hasText(receipt.tester?.date) ||
    !hasText(receipt.tester?.environment)
  ) {
    failedChecks.push("tester_identity");
  }
  if (
    receipt.productScope !== "bounded_core_teaching_loop" ||
    receipt.allSoftwareObjective !== "paused" ||
    receipt.releaseDecision !== "do_not_release"
  ) {
    failedChecks.push("bounded_not_release_scope");
  }
  if (
    receipt.reviewOnly !== true ||
    receipt.accepted !== false ||
    receipt.packagingGated !== true ||
    receipt.locks?.mustNotSaveAcceptance !== true ||
    receipt.locks.mustNotEnableRules !== true ||
    receipt.locks.mustNotUnlockPackaging !== true ||
    receipt.locks.mustNotClaimReleaseReady !== true ||
    receipt.locks.mustNotResumeAllSoftwareObjective !== true
  ) {
    failedChecks.push("locked_review_only_boundary");
  }
  if (
    !Array.isArray(receipt.betaDecisionAllowedValues) ||
    !publicBetaFeedbackAllowedDecisions.every((decision) =>
      receipt.betaDecisionAllowedValues?.includes(decision)
    ) ||
    !publicBetaFeedbackAllowedDecisions.includes(receipt.betaDecision as PublicBetaFeedbackDecision) ||
    receipt.defaultBetaDecision !== "needs_fix_before_more_testers"
  ) {
    failedChecks.push("beta_decision_allowed");
  }
  if (
    !isBoolean(receipt.setup?.couldStartProductRuntime) ||
    !isBoolean(receipt.setup?.healthEndpointHealthy) ||
    !isBoolean(receipt.setup?.liveHandoffChecked)
  ) {
    failedChecks.push("setup_checks_complete");
  }
  if (
    !isBoolean(receipt.coreLoop?.firstRunClear) ||
    !isBoolean(receipt.coreLoop?.traceUnderstandable) ||
    !isBoolean(receipt.coreLoop?.correctionSubmitted) ||
    !isBoolean(receipt.coreLoop?.ruleProvenanceVisible) ||
    !isBoolean(receipt.coreLoop?.rerunChangedBehavior)
  ) {
    failedChecks.push("core_loop_checks_complete");
  }
  if (
    !isBoolean(receipt.trustAndBoundaries?.learnedBehaviorClear) ||
    !isBoolean(receipt.trustAndBoundaries?.reviewOnlyBoundaryClear) ||
    receipt.trustAndBoundaries?.noReleaseOrAllSoftwareClaim !== true
  ) {
    failedChecks.push("trust_boundary_checks_complete");
  }
  if (!hasText(receipt.nextActionRecommendation)) {
    failedChecks.push("next_action");
  }
  if (receipt.betaDecision === "blocked" && !hasText(receipt.blockers?.blockingIssue)) {
    failedChecks.push("blocked_receipt_has_blocker");
  }

  return { valid: failedChecks.length === 0, failedChecks };
}

function destinationFor(receipt: PublicBetaFeedbackReceipt, inboxDir: string) {
  const tester = safeName(receipt.tester?.name ?? "tester") || "tester";
  const date = safeName(receipt.tester?.date ?? new Date().toISOString().slice(0, 10)) || "undated";
  const decision = safeName(receipt.betaDecision ?? "feedback") || "feedback";
  let destination = path.join(inboxDir, `${date}-${tester}-${decision}.json`);
  let suffix = 2;

  while (fs.existsSync(destination)) {
    destination = path.join(inboxDir, `${date}-${tester}-${decision}-${suffix}.json`);
    suffix += 1;
  }

  return destination;
}

export function readPublicBetaFeedbackInboxSummary() {
  fs.mkdirSync(publicBetaFeedbackInboxDir, { recursive: true });
  const receiptFiles = fs
    .readdirSync(publicBetaFeedbackInboxDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".json"))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b));

  return {
    responseMode: "public_beta_feedback_inbox_summary_json_v1",
    status: receiptFiles.length === 0 ? "waiting_for_feedback" : "has_feedback",
    inboxDir: relativeArtifactPath(publicBetaFeedbackInboxDir),
    totalReceipts: receiptFiles.length,
    receiptFiles
  };
}

export function savePublicBetaFeedbackReceipt(receipt: PublicBetaFeedbackReceipt, options?: { dryRun?: boolean }) {
  const validation = validatePublicBetaFeedbackReceipt(receipt);
  const dryRun = options?.dryRun === true;
  const savedAt = new Date().toISOString();

  if (!validation.valid) {
    return {
      responseMode: "public_beta_feedback_save_receipt_json_v1",
      status: "rejected",
      saved: false,
      dryRun,
      generatedAt: savedAt,
      productScope: "bounded_core_teaching_loop",
      allSoftwareObjective: "paused",
      releaseDecision: "do_not_release",
      reviewOnly: true,
      accepted: false,
      packagingGated: true,
      failedChecks: validation.failedChecks,
      nextAction: "Fix the feedback receipt before using it for beta follow-up planning."
    };
  }

  if (dryRun) {
    return {
      responseMode: "public_beta_feedback_save_receipt_json_v1",
      status: "validated_dry_run",
      saved: false,
      dryRun: true,
      generatedAt: savedAt,
      productScope: "bounded_core_teaching_loop",
      allSoftwareObjective: "paused",
      releaseDecision: "do_not_release",
      reviewOnly: true,
      accepted: false,
      packagingGated: true,
      failedChecks: [],
      nextAction: "Submit without dryRun=true to save this review-only beta feedback receipt."
    };
  }

  fs.mkdirSync(publicBetaFeedbackInboxDir, { recursive: true });
  fs.mkdirSync(publicBetaFeedbackHistoryDir, { recursive: true });

  const inboxPath = destinationFor(receipt, publicBetaFeedbackInboxDir);
  const historyPath = path.join(publicBetaFeedbackHistoryDir, `${savedAt.replace(/[:.]/g, "-")}.json`);
  const storedReceipt = {
    ...receipt,
    savedAt
  };
  fs.writeFileSync(inboxPath, JSON.stringify(storedReceipt, null, 2));
  fs.writeFileSync(historyPath, JSON.stringify(storedReceipt, null, 2));

  return {
    responseMode: "public_beta_feedback_save_receipt_json_v1",
    status: "saved_to_feedback_inbox",
    saved: true,
    dryRun: false,
    generatedAt: savedAt,
    productScope: "bounded_core_teaching_loop",
    allSoftwareObjective: "paused",
    releaseDecision: "do_not_release",
    reviewOnly: true,
    accepted: false,
    packagingGated: true,
    failedChecks: [],
    inboxReceiptPath: relativeArtifactPath(inboxPath),
    historyReceiptPath: relativeArtifactPath(historyPath),
    nextAction:
      "Run npm run collect:public-beta-feedback and npm run plan:public-beta-follow-up before inviting another tester."
  };
}
