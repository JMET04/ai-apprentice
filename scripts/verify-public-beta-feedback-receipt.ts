import fs from "node:fs";
import path from "node:path";

type FeedbackCheck = {
  name: string;
  pass: boolean;
  evidence: string;
};

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

const artifactsDir = path.join(process.cwd(), "artifacts", "productization");
const defaultReceiptPath = path.join(
  artifactsDir,
  "public-beta-packet",
  "docs",
  "PUBLIC_BETA_FEEDBACK_RECEIPT.template.json"
);
const validationPath = path.join(artifactsDir, "public-beta-feedback-receipt-validation.json");
const allowedDecisions = ["ready_for_next_beta_tester", "needs_fix_before_more_testers", "blocked"];

function push(checks: FeedbackCheck[], name: string, pass: boolean, evidence: string) {
  checks.push({ name, pass, evidence });
}

function hasText(value: unknown) {
  return typeof value === "string" && value.trim().length > 0;
}

function isFilledBoolean(value: unknown) {
  return typeof value === "boolean";
}

function evidenceValue(value: unknown) {
  return value === null ? "null" : String(value ?? "missing");
}

function parseReceiptPath() {
  const receiptFlagIndex = process.argv.indexOf("--receipt");

  if (receiptFlagIndex >= 0) {
    const value = process.argv[receiptFlagIndex + 1];
    if (!value || value.startsWith("--")) {
      throw new Error("Missing value for --receipt.");
    }
    return path.resolve(process.cwd(), value);
  }

  const positional = process.argv.slice(2).find((arg) => !arg.startsWith("--"));
  return positional ? path.resolve(process.cwd(), positional) : defaultReceiptPath;
}

function readReceipt(receiptPath: string): FeedbackReceipt | null {
  try {
    const raw = fs.readFileSync(receiptPath, "utf8").replace(/^\uFEFF/, "");
    return JSON.parse(raw) as FeedbackReceipt;
  } catch {
    return null;
  }
}

function main() {
  const receiptPath = parseReceiptPath();
  const receipt = readReceipt(receiptPath);
  const checks: FeedbackCheck[] = [];
  const isTemplate = path.basename(receiptPath) === "PUBLIC_BETA_FEEDBACK_RECEIPT.template.json";

  push(
    checks,
    "Feedback receipt JSON exists",
    Boolean(receipt),
    `path=${path.relative(process.cwd(), receiptPath)}`
  );

  push(
    checks,
    "Feedback receipt mode is recognized",
    receipt?.responseMode === "public_beta_feedback_receipt_template_json_v1",
    `responseMode=${receipt?.responseMode ?? "missing"}`
  );

  push(
    checks,
    "Feedback receipt stays in bounded beta scope",
    receipt?.productScope === "bounded_core_teaching_loop" &&
      receipt.allSoftwareObjective === "paused" &&
      receipt.releaseDecision === "do_not_release",
    `scope=${receipt?.productScope ?? "missing"}; allSoftware=${receipt?.allSoftwareObjective ?? "missing"}; release=${
      receipt?.releaseDecision ?? "missing"
    }`
  );

  push(
    checks,
    "Feedback receipt cannot unlock release boundaries",
    receipt?.reviewOnly === true &&
      receipt.accepted === false &&
      receipt.packagingGated === true &&
      receipt.locks?.mustNotSaveAcceptance === true &&
      receipt.locks.mustNotEnableRules === true &&
      receipt.locks.mustNotUnlockPackaging === true &&
      receipt.locks.mustNotClaimReleaseReady === true &&
      receipt.locks.mustNotResumeAllSoftwareObjective === true,
    `reviewOnly=${receipt?.reviewOnly ?? "missing"}; accepted=${receipt?.accepted ?? "missing"}; packagingGated=${
      receipt?.packagingGated ?? "missing"
    }`
  );

  push(
    checks,
    "Feedback beta decision is constrained",
    Array.isArray(receipt?.betaDecisionAllowedValues) &&
      allowedDecisions.every((decision) => receipt.betaDecisionAllowedValues?.includes(decision)) &&
      allowedDecisions.includes(receipt.betaDecision ?? "") &&
      receipt.defaultBetaDecision === "needs_fix_before_more_testers",
    `decision=${receipt?.betaDecision ?? "missing"}; default=${receipt?.defaultBetaDecision ?? "missing"}`
  );

  if (isTemplate) {
    push(
      checks,
      "Template keeps unfilled fields neutral",
      receipt?.status === "not_filled_yet" &&
        receipt.tester?.name === "" &&
        receipt.tester.environment === "" &&
        receipt.setup?.couldStartProductRuntime === null &&
        receipt.coreLoop?.firstRunClear === null &&
        receipt.trustAndBoundaries?.learnedBehaviorClear === null,
      `status=${receipt?.status ?? "missing"}; tester=${receipt?.tester?.name ?? "missing"}; setup=${
        evidenceValue(receipt?.setup?.couldStartProductRuntime)
      }`
    );
  } else {
    push(
      checks,
      "Submitted feedback has tester identity and environment",
      receipt?.status === "submitted" &&
        hasText(receipt.tester?.name) &&
        hasText(receipt.tester?.date) &&
        hasText(receipt.tester?.environment),
      `status=${receipt?.status ?? "missing"}; tester=${receipt?.tester?.name ?? "missing"}; date=${
        receipt?.tester?.date ?? "missing"
      }; environment=${receipt?.tester?.environment ?? "missing"}`
    );

    push(
      checks,
      "Submitted setup checks are complete",
      isFilledBoolean(receipt?.setup?.couldStartProductRuntime) &&
        isFilledBoolean(receipt?.setup?.healthEndpointHealthy) &&
        isFilledBoolean(receipt?.setup?.liveHandoffChecked),
      `start=${receipt?.setup?.couldStartProductRuntime ?? "missing"}; health=${
        receipt?.setup?.healthEndpointHealthy ?? "missing"
      }; liveHandoff=${receipt?.setup?.liveHandoffChecked ?? "missing"}`
    );

    push(
      checks,
      "Submitted core loop checks are complete",
      isFilledBoolean(receipt?.coreLoop?.firstRunClear) &&
        isFilledBoolean(receipt?.coreLoop?.traceUnderstandable) &&
        isFilledBoolean(receipt?.coreLoop?.correctionSubmitted) &&
        isFilledBoolean(receipt?.coreLoop?.ruleProvenanceVisible) &&
        isFilledBoolean(receipt?.coreLoop?.rerunChangedBehavior),
      `firstRun=${receipt?.coreLoop?.firstRunClear ?? "missing"}; trace=${
        receipt?.coreLoop?.traceUnderstandable ?? "missing"
      }; correction=${receipt?.coreLoop?.correctionSubmitted ?? "missing"}; provenance=${
        receipt?.coreLoop?.ruleProvenanceVisible ?? "missing"
      }; rerun=${receipt?.coreLoop?.rerunChangedBehavior ?? "missing"}`
    );

    push(
      checks,
      "Submitted trust boundary checks are complete",
      isFilledBoolean(receipt?.trustAndBoundaries?.learnedBehaviorClear) &&
        isFilledBoolean(receipt?.trustAndBoundaries?.reviewOnlyBoundaryClear) &&
        receipt.trustAndBoundaries.noReleaseOrAllSoftwareClaim === true,
      `learned=${receipt?.trustAndBoundaries?.learnedBehaviorClear ?? "missing"}; boundary=${
        receipt?.trustAndBoundaries?.reviewOnlyBoundaryClear ?? "missing"
      }; noReleaseClaim=${receipt?.trustAndBoundaries?.noReleaseOrAllSoftwareClaim ?? "missing"}`
    );

    push(
      checks,
      "Submitted feedback has an actionable next step",
      hasText(receipt?.nextActionRecommendation) &&
        (receipt?.betaDecision !== "blocked" || hasText(receipt.blockers?.blockingIssue)),
      `decision=${receipt?.betaDecision ?? "missing"}; nextAction=${hasText(
        receipt?.nextActionRecommendation
      )}; blockingIssue=${hasText(receipt?.blockers?.blockingIssue)}`
    );
  }

  const passed = checks.filter((check) => check.pass).length;
  const validationStatus =
    passed === checks.length ? (isTemplate ? "template_ready" : "passed") : "failed";
  const validation = {
    responseMode: "public_beta_feedback_receipt_validation_json_v1",
    status: validationStatus,
    generatedAt: new Date().toISOString(),
    command: isTemplate
      ? "npm run verify:public-beta-feedback"
      : `npm run verify:public-beta-feedback -- --receipt ${path.relative(process.cwd(), receiptPath)}`,
    inputPath: path.relative(process.cwd(), receiptPath),
    mode: isTemplate ? "template" : "submitted_receipt",
    productScope: "bounded_core_teaching_loop",
    allSoftwareObjective: "paused",
    releaseDecision: "do_not_release",
    betaDecision: receipt?.betaDecision ?? "missing",
    betaCanContinue:
      !isTemplate && validationStatus === "passed" && receipt?.betaDecision === "ready_for_next_beta_tester",
    reviewOnly: true,
    accepted: false,
    packagingGated: true,
    passed,
    total: checks.length,
    checks,
    nextAction:
      validationStatus === "failed"
        ? "Fix the beta feedback receipt before using it for follow-up planning."
        : isTemplate
          ? "Give testers a copy of the template and validate submitted receipts with -- --receipt <path>."
          : receipt?.betaDecision === "ready_for_next_beta_tester"
            ? "Proceed to the next bounded beta tester; this still does not unlock release or packaging."
            : "Use the submitted feedback as review-only follow-up input before inviting more testers."
  };

  fs.mkdirSync(artifactsDir, { recursive: true });
  fs.writeFileSync(validationPath, JSON.stringify(validation, null, 2));
  console.log(JSON.stringify(validation, null, 2));
  console.log(`\nPublic beta feedback receipt validation written to ${validationPath}`);

  if (validation.status === "failed") {
    process.exitCode = 1;
  }
}

try {
  main();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}

export {};
