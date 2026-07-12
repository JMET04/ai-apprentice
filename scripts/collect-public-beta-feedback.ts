import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

type FeedbackReceipt = {
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
    date?: string;
    environment?: string;
  };
  setup?: {
    couldStartProductRuntime?: boolean | null;
    healthEndpointHealthy?: boolean | null;
    liveHandoffChecked?: boolean | null;
  };
  coreLoop?: {
    firstRunClear?: boolean | null;
    traceUnderstandable?: boolean | null;
    correctionSubmitted?: boolean | null;
    ruleProvenanceVisible?: boolean | null;
    rerunChangedBehavior?: boolean | null;
  };
  trustAndBoundaries?: {
    learnedBehaviorClear?: boolean | null;
    reviewOnlyBoundaryClear?: boolean | null;
    noReleaseOrAllSoftwareClaim?: boolean | null;
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

type ReceiptSummary = {
  file: string;
  valid: boolean;
  testerName: string;
  testerDate: string;
  betaDecision: string;
  blocker: string;
  nextActionRecommendation: string;
  failedChecks: string[];
};

type TesterLaunchGate = {
  requiredImmediatelyBeforeContact: boolean;
  command: string;
  evidencePath: string;
  stopIf: string;
};

const artifactsDir = path.join(process.cwd(), "artifacts", "productization");
const defaultInboxDir = path.join(artifactsDir, "public-beta-feedback-inbox");
const collectionPath = path.join(artifactsDir, "public-beta-feedback-collection.json");
const allowedDecisions = ["ready_for_next_beta_tester", "needs_fix_before_more_testers", "blocked"];
const testerLaunchPreflight: TesterLaunchGate = {
  requiredImmediatelyBeforeContact: true,
  command: "npm run preflight:public-beta-tester -- --base-url http://127.0.0.1:3000",
  evidencePath: "artifacts/productization/public-beta-tester-session-preflight.json",
  stopIf:
    "Do not contact a tester if the live preflight is missing, stale, failed, or releaseDecision is not do_not_release."
};

function hasText(value: unknown) {
  return typeof value === "string" && value.trim().length > 0;
}

function isBoolean(value: unknown) {
  return typeof value === "boolean";
}

function parseInboxDir() {
  const dirFlagIndex = process.argv.indexOf("--dir");

  if (dirFlagIndex >= 0) {
    const value = process.argv[dirFlagIndex + 1];
    if (!value || value.startsWith("--")) {
      throw new Error("Missing value for --dir.");
    }
    return path.resolve(process.cwd(), value);
  }

  return defaultInboxDir;
}

function parseOutputPath() {
  const outFlagIndex = process.argv.indexOf("--out");

  if (outFlagIndex >= 0) {
    const value = process.argv[outFlagIndex + 1];
    if (!value || value.startsWith("--")) {
      throw new Error("Missing value for --out.");
    }
    return path.resolve(process.cwd(), value);
  }

  return collectionPath;
}

function readJson(filePath: string): FeedbackReceipt | null {
  try {
    const raw = fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, "");
    return JSON.parse(raw) as FeedbackReceipt;
  } catch {
    return null;
  }
}

function validateReceipt(receipt: FeedbackReceipt | null) {
  const failedChecks: string[] = [];

  if (!receipt) {
    return ["receipt_json_parseable"];
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
    !allowedDecisions.every((decision) => receipt.betaDecisionAllowedValues?.includes(decision)) ||
    !allowedDecisions.includes(receipt.betaDecision ?? "") ||
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

  return failedChecks;
}

export function collectPublicBetaFeedback(args: {
  inboxDir?: string;
  outputPath?: string;
}) {
  const inboxDir = args.inboxDir ?? defaultInboxDir;
  const outputPath = args.outputPath ?? collectionPath;
  fs.mkdirSync(inboxDir, { recursive: true });

  const receiptFiles = fs
    .readdirSync(inboxDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".json"))
    .map((entry) => path.join(inboxDir, entry.name))
    .sort((a, b) => a.localeCompare(b));

  const receipts: ReceiptSummary[] = receiptFiles.map((filePath) => {
    const receipt = readJson(filePath);
    const failedChecks = validateReceipt(receipt);

    return {
      file: path.relative(process.cwd(), filePath),
      valid: failedChecks.length === 0,
      testerName: receipt?.tester?.name ?? "",
      testerDate: receipt?.tester?.date ?? "",
      betaDecision: receipt?.betaDecision ?? "invalid",
      blocker: receipt?.blockers?.blockingIssue ?? "",
      nextActionRecommendation: receipt?.nextActionRecommendation ?? "",
      failedChecks
    };
  });

  const validReceipts = receipts.filter((receipt) => receipt.valid);
  const invalidReceipts = receipts.filter((receipt) => !receipt.valid);
  const decisionCounts = Object.fromEntries(
    allowedDecisions.map((decision) => [
      decision,
      validReceipts.filter((receipt) => receipt.betaDecision === decision).length
    ])
  );
  const status =
    receiptFiles.length === 0
      ? "waiting_for_feedback"
      : invalidReceipts.length > 0
        ? "has_invalid_feedback"
        : validReceipts.some((receipt) => receipt.betaDecision === "blocked")
          ? "blocked_by_beta_feedback"
          : validReceipts.some((receipt) => receipt.betaDecision === "needs_fix_before_more_testers")
          ? "needs_fix_before_more_testers"
          : "ready_for_next_beta_tester";
  const canInviteTester = status === "waiting_for_feedback" || status === "ready_for_next_beta_tester";
  const commandArgs = [
    inboxDir === defaultInboxDir ? "" : `--dir ${path.relative(process.cwd(), inboxDir)}`,
    outputPath === collectionPath ? "" : `--out ${path.relative(process.cwd(), outputPath)}`
  ].filter(Boolean);

  const collection = {
    responseMode: "public_beta_feedback_collection_json_v1",
    status,
    generatedAt: new Date().toISOString(),
    command:
      commandArgs.length > 0
        ? `npm run collect:public-beta-feedback -- ${commandArgs.join(" ")}`
        : "npm run collect:public-beta-feedback",
    inboxDir: path.relative(process.cwd(), inboxDir),
    productScope: "bounded_core_teaching_loop",
    allSoftwareObjective: "paused",
    releaseDecision: "do_not_release",
    reviewOnly: true,
    accepted: false,
    packagingGated: true,
    totalReceipts: receipts.length,
    validReceipts: validReceipts.length,
    invalidReceipts: invalidReceipts.length,
    decisionCounts,
    receipts,
    testerLaunchGate: canInviteTester ? testerLaunchPreflight : null,
    nextAction:
      status === "waiting_for_feedback"
        ? "Run the live tester preflight, then invite one bounded beta tester; process returned JSON receipts with npm run intake:public-beta-return -- --receipt <path> --session-receipt <session-receipt-path> --send-receipt-validation artifacts/productization/first-real-tester-send-receipt-validation.json before they enter the feedback queue."
        : status === "has_invalid_feedback"
          ? "Fix invalid feedback receipts before using them for follow-up planning."
          : status === "blocked_by_beta_feedback"
            ? "Preserve blockers and stop inviting more testers until the blocking issue is reviewed."
            : status === "needs_fix_before_more_testers"
              ? "Plan fixes from beta feedback before inviting more testers."
              : "Run the live tester preflight, then proceed to the next bounded beta tester; release and packaging remain locked."
  };

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(collection, null, 2));
  return collection;
}

function main() {
  const collection = collectPublicBetaFeedback({
    inboxDir: parseInboxDir(),
    outputPath: parseOutputPath()
  });
  console.log(JSON.stringify(collection, null, 2));
  console.log(
    `\nPublic beta feedback collection written to ${
      parseOutputPath() === collectionPath ? collectionPath : parseOutputPath()
    }`
  );

  if (collection.status === "has_invalid_feedback") {
    process.exitCode = 1;
  }
}

const currentFile = fileURLToPath(import.meta.url);
if (path.resolve(process.argv[1] ?? "") === currentFile) {
  try {
    main();
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }
}

export {};
