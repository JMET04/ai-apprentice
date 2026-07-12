import fs from "node:fs";
import path from "node:path";

type VerificationCheck = {
  name: string;
  pass: boolean;
  evidence: string;
};

type HumanAcceptanceReceipt = {
  responseMode?: string;
  status?: string;
  productScope?: string;
  stableTaskId?: string;
  allSoftwareObjective?: string;
  releaseDecision?: string;
  reviewOnly?: boolean;
  accepted?: boolean;
  packagingGated?: boolean;
  canRelease?: boolean;
  canActivateRealModel?: boolean;
  humanAcceptanceDecisionAllowedValues?: string[];
  defaultHumanAcceptanceDecision?: string;
  reviewer?: {
    name?: string;
    role?: string;
    date?: string;
    environment?: string;
  };
  reviewedFlow?: {
    manualTestUrl?: string;
    runUrl?: string;
    reviewUrl?: string;
  };
  manualTestEvidence?: {
    savedReceiptPath?: string;
    latestReportPath?: string;
    historyReportPath?: string;
    evidenceKind?: string;
    humanReviewed?: boolean | null;
    automationGenerated?: boolean | null;
    classificationReason?: string;
  };
  gateVerification?: {
    gateReportPath?: string;
    command?: string;
    status?: string;
    latestEvidenceKind?: string;
    latestHumanReviewed?: boolean | null;
    latestAutomationGenerated?: boolean | null;
  };
  reviewChecks?: {
    manualTestOpened?: boolean | null;
    stableTaskRunCompleted?: boolean | null;
    traceVisibleWithoutPrivateCot?: boolean | null;
    correctionLoopReviewed?: boolean | null;
    allManualStepsPassedWithNotes?: boolean | null;
    manualReviewAttestationConfirmed?: boolean | null;
    savedEvidenceKindHumanReview?: boolean | null;
    savedEvidenceVerifiedByGate?: boolean | null;
    packagingStillGated?: boolean | null;
    releaseStillDoNotRelease?: boolean | null;
    allSoftwareStillPaused?: boolean | null;
    realModelNotAcceptedByThisReview?: boolean | null;
  };
  stepResults?: Array<{
    id?: string;
    status?: string;
    note?: string;
    evidencePath?: string;
  }>;
  blockers?: {
    blockingIssue?: string;
    confusingUx?: string;
    missingEvidence?: string;
    unsafeOrUnexpectedBehavior?: string;
    evidencePath?: string;
  };
  humanAcceptanceDecision?: string;
  nextActionRecommendation?: string;
  locks?: {
    mustNotSaveAcceptanceFromReceipt?: boolean;
    mustNotEnableRules?: boolean;
    mustNotUnlockPackaging?: boolean;
    mustNotClaimReleaseReady?: boolean;
    mustNotAcceptRealModel?: boolean;
    mustNotResumeAllSoftwareObjective?: boolean;
  };
};


type ManualAcceptanceEvidence = {
  responseMode?: string;
  source?: string;
  evidenceKind?: string;
  humanReviewed?: boolean;
  automationGenerated?: boolean;
  classificationReason?: string;
  reviewOnly?: boolean;
  accepted?: boolean;
  packagingGated?: boolean;
  humanReviewEvidence?: {
    responseMode?: string;
    reviewerName?: string;
    stepCount?: number;
    attestation?: string;
    savedFrom?: string;
  };
  report?: {
    summary?: {
      readyForHumanTrial?: boolean;
      failed?: number;
      notRun?: number;
    };
    steps?: Array<{
      status?: string;
      note?: string;
    }>;
  };
};
type HumanAcceptanceGate = {
  responseMode?: string;
  status?: string;
  latestManualAcceptancePath?: string;
  latestEvidenceKind?: string;
  latestHumanReviewed?: boolean;
  latestAutomationGenerated?: boolean;
  passed?: number;
  total?: number;
  checks?: Array<{ pass?: boolean }>;
  releaseBoundary?: {
    reviewOnly?: boolean;
    accepted?: boolean;
    packagingGated?: boolean;
  };
};

const artifactsDir = path.join(process.cwd(), "artifacts", "productization");
const defaultReceiptPath = path.join(artifactsDir, "human-acceptance-receipt.template.json");
const validationPath = path.join(artifactsDir, "human-acceptance-receipt-validation.json");
const allowedDecisions = ["needs_follow_up", "blocked", "ready_for_gate_verification"];
const requiredStepIds = [
  "open_manual_test",
  "run_stable_task",
  "inspect_trace_and_review",
  "exercise_correction_loop",
  "save_human_review_evidence",
  "maintainer_verify_gate"
];

function push(checks: VerificationCheck[], name: string, pass: boolean, evidence: string) {
  checks.push({ name, pass, evidence });
}

function hasText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
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

function parseOutputPath() {
  const outputFlagIndex = process.argv.indexOf("--out");

  if (outputFlagIndex >= 0) {
    const value = process.argv[outputFlagIndex + 1];
    if (!value || value.startsWith("--")) {
      throw new Error("Missing value for --out.");
    }
    return path.resolve(process.cwd(), value);
  }

  return validationPath;
}

function readReceipt(receiptPath: string): HumanAcceptanceReceipt | null {
  try {
    const raw = fs.readFileSync(receiptPath, "utf8").replace(/^\uFEFF/, "");
    return JSON.parse(raw) as HumanAcceptanceReceipt;
  } catch {
    return null;
  }
}


function readJsonFile<T>(targetPath: string): T | null {
  try {
    const raw = fs.readFileSync(targetPath, "utf8").replace(/^\uFEFF/, "");
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function resolveEvidencePath(receiptPath: string, evidencePath: unknown) {
  if (!hasText(evidencePath)) return null;
  if (path.isAbsolute(evidencePath)) return evidencePath;

  const cwdRelative = path.resolve(process.cwd(), evidencePath);
  if (fs.existsSync(cwdRelative)) return cwdRelative;

  return path.resolve(path.dirname(receiptPath), evidencePath);
}

function readEvidence<T>(receiptPath: string, evidencePath: unknown) {
  const resolvedPath = resolveEvidencePath(receiptPath, evidencePath);
  if (!resolvedPath) return { resolvedPath: null, evidence: null };
  return { resolvedPath, evidence: readJsonFile<T>(resolvedPath) };
}

function sameText(left: unknown, right: unknown) {
  return hasText(left) && hasText(right) && left.trim().toLowerCase() === right.trim().toLowerCase();
}

function isRealHumanReviewEvidence(evidence: ManualAcceptanceEvidence | null, reviewerName: unknown) {
  const steps = evidence?.report?.steps ?? [];
  return (
    evidence?.responseMode === "manual_acceptance_saved_receipt_json_v1" &&
    evidence.evidenceKind === "human_review" &&
    evidence.humanReviewed === true &&
    evidence.automationGenerated === false &&
    evidence.classificationReason === "valid_human_review_evidence" &&
    evidence.reviewOnly === true &&
    evidence.accepted === false &&
    evidence.packagingGated === true &&
    evidence.humanReviewEvidence?.responseMode === "manual_test_workbench_human_review_evidence_v1" &&
    evidence.humanReviewEvidence.attestation === "human-reviewed-manual-test-workbench" &&
    evidence.humanReviewEvidence.savedFrom === "manual-test-workbench" &&
    sameText(evidence.humanReviewEvidence.reviewerName, reviewerName) &&
    evidence.report?.summary?.readyForHumanTrial === true &&
    evidence.report.summary.failed === 0 &&
    evidence.report.summary.notRun === 0 &&
    steps.length > 0 &&
    steps.every((step) => step.status === "passed" && hasText(step.note))
  );
}
function isHumanAcceptanceGatePassed(
  gate: HumanAcceptanceGate | null,
  latestManualEvidence: ManualAcceptanceEvidence | null,
  reviewerName: unknown
) {
  return (
    gate?.responseMode === 'human_acceptance_gate_json_v1' &&
    gate.status === 'passed' &&
    gate.latestEvidenceKind === 'human_review' &&
    gate.latestHumanReviewed === true &&
    gate.latestAutomationGenerated === false &&
    gate.releaseBoundary?.reviewOnly === true &&
    gate.releaseBoundary.accepted === false &&
    gate.releaseBoundary.packagingGated === true &&
    Number(gate.passed ?? 0) === Number(gate.total ?? -1) &&
    Number(gate.total ?? 0) > 0 &&
    gate.checks?.every((check) => check.pass === true) === true &&
    isRealHumanReviewEvidence(latestManualEvidence, reviewerName)
  );
}


function containsForbiddenClaim(value: unknown): boolean {
  if (typeof value === "string") {
    return /accepted\s*=\s*true|packagingGated\s*=\s*false|releaseDecision\s*=\s*release_ready/i.test(value);
  }
  if (Array.isArray(value)) {
    return value.some((item) => containsForbiddenClaim(item));
  }
  if (value && typeof value === "object") {
    return Object.values(value).some((item) => containsForbiddenClaim(item));
  }
  return false;
}

function main() {
  const receiptPath = parseReceiptPath();
  const outputPath = parseOutputPath();
  const receipt = readReceipt(receiptPath);
  const checks: VerificationCheck[] = [];
  const isTemplate = path.basename(receiptPath) === "human-acceptance-receipt.template.json";

  push(checks, "Human acceptance receipt JSON exists", Boolean(receipt), `path=${path.relative(process.cwd(), receiptPath)}`);

  push(
    checks,
    "Human acceptance receipt mode is recognized",
    receipt?.responseMode === "human_acceptance_review_receipt_json_v1",
    `responseMode=${receipt?.responseMode ?? "missing"}`
  );

  push(
    checks,
    "Human acceptance receipt stays in bounded product scope",
    receipt?.productScope === "bounded_core_teaching_loop" &&
      receipt.stableTaskId === "task-photo-travel-journal" &&
      receipt.allSoftwareObjective === "paused" &&
      receipt.releaseDecision === "do_not_release",
    `scope=${receipt?.productScope ?? "missing"}; task=${receipt?.stableTaskId ?? "missing"}; allSoftware=${
      receipt?.allSoftwareObjective ?? "missing"
    }; release=${receipt?.releaseDecision ?? "missing"}`
  );

  push(
    checks,
    "Human acceptance receipt cannot unlock release boundaries",
    receipt?.reviewOnly === true &&
      receipt.accepted === false &&
      receipt.packagingGated === true &&
      receipt.canRelease === false &&
      receipt.canActivateRealModel === false &&
      receipt.locks?.mustNotSaveAcceptanceFromReceipt === true &&
      receipt.locks.mustNotEnableRules === true &&
      receipt.locks.mustNotUnlockPackaging === true &&
      receipt.locks.mustNotClaimReleaseReady === true &&
      receipt.locks.mustNotAcceptRealModel === true &&
      receipt.locks.mustNotResumeAllSoftwareObjective === true,
    `reviewOnly=${receipt?.reviewOnly ?? "missing"}; accepted=${receipt?.accepted ?? "missing"}; packagingGated=${
      receipt?.packagingGated ?? "missing"
    }; canRelease=${receipt?.canRelease ?? "missing"}; canActivateRealModel=${
      receipt?.canActivateRealModel ?? "missing"
    }`
  );

  push(
    checks,
    "Human acceptance decision is constrained",
    Array.isArray(receipt?.humanAcceptanceDecisionAllowedValues) &&
      allowedDecisions.every((decision) => receipt.humanAcceptanceDecisionAllowedValues?.includes(decision)) &&
      allowedDecisions.includes(receipt.humanAcceptanceDecision ?? "") &&
      receipt.defaultHumanAcceptanceDecision === "needs_follow_up",
    `decision=${receipt?.humanAcceptanceDecision ?? "missing"}; default=${
      receipt?.defaultHumanAcceptanceDecision ?? "missing"
    }`
  );

  push(
    checks,
    "Human acceptance receipt does not claim forbidden outcomes",
    Boolean(receipt) && !containsForbiddenClaim(receipt),
    "Scans receipt values for accepted=true, packagingGated=false, or release-ready claims."
  );

  if (isTemplate) {
    push(
      checks,
      "Template keeps unfilled fields neutral",
      receipt?.status === "not_filled_yet" &&
        receipt.reviewer?.name === "" &&
        receipt.manualTestEvidence?.savedReceiptPath === "" &&
        receipt.manualTestEvidence?.humanReviewed === null &&
        receipt.gateVerification?.gateReportPath === 'artifacts/productization/human-acceptance-gate.json' &&
        receipt.gateVerification?.command === 'npm run verify:human-acceptance' &&
        receipt.gateVerification?.status === '' &&
        receipt.gateVerification?.latestHumanReviewed === null &&
        receipt.reviewChecks?.manualTestOpened === null &&
        receipt.stepResults?.every((step) => step.status === "not_run" && step.note === "") === true,
      `status=${receipt?.status ?? "missing"}; reviewer=${receipt?.reviewer?.name ?? "missing"}; humanReviewed=${evidenceValue(
        receipt?.manualTestEvidence?.humanReviewed
      )}`
    );
  } else {
    push(
      checks,
      "Submitted human acceptance receipt has reviewer identity",
      receipt?.status === "submitted" &&
        hasText(receipt.reviewer?.name) &&
        hasText(receipt.reviewer?.role) &&
        hasText(receipt.reviewer?.date) &&
        hasText(receipt.reviewer?.environment),
      `status=${receipt?.status ?? "missing"}; reviewer=${receipt?.reviewer?.name ?? "missing"}; date=${
        receipt?.reviewer?.date ?? "missing"
      }`
    );

    const savedManualEvidence = readEvidence<ManualAcceptanceEvidence>(
      receiptPath,
      receipt?.manualTestEvidence?.savedReceiptPath
    );
    const latestManualEvidence = readEvidence<ManualAcceptanceEvidence>(
      receiptPath,
      receipt?.manualTestEvidence?.latestReportPath
    );
    const gateEvidence = readEvidence<HumanAcceptanceGate>(receiptPath, receipt?.gateVerification?.gateReportPath);
    const savedEvidenceValid = isRealHumanReviewEvidence(savedManualEvidence.evidence, receipt?.reviewer?.name);
    const latestEvidenceValid = latestManualEvidence.resolvedPath
      ? isRealHumanReviewEvidence(latestManualEvidence.evidence, receipt?.reviewer?.name)
      : true;

    push(
      checks,
      "Submitted manual-test evidence is artifact-backed real human review",
      hasText(receipt?.manualTestEvidence?.savedReceiptPath) &&
        savedEvidenceValid &&
        latestEvidenceValid &&
        receipt?.manualTestEvidence?.evidenceKind === savedManualEvidence.evidence?.evidenceKind &&
        receipt?.manualTestEvidence?.humanReviewed === savedManualEvidence.evidence?.humanReviewed &&
        receipt?.manualTestEvidence?.automationGenerated === savedManualEvidence.evidence?.automationGenerated &&
        receipt?.manualTestEvidence?.classificationReason === savedManualEvidence.evidence?.classificationReason,
      `receiptKind=${receipt?.manualTestEvidence?.evidenceKind ?? "missing"}; savedKind=${
        savedManualEvidence.evidence?.evidenceKind ?? "missing"
      }; reviewer=${savedManualEvidence.evidence?.humanReviewEvidence?.reviewerName ?? "missing"}; latestValid=${
        latestEvidenceValid
      }`
    );

    push(
      checks,
      'Submitted human acceptance gate is artifact-backed and passed',
      hasText(receipt?.gateVerification?.gateReportPath) &&
        isHumanAcceptanceGatePassed(gateEvidence.evidence, latestManualEvidence.evidence, receipt?.reviewer?.name) &&
        receipt?.gateVerification?.status === gateEvidence.evidence?.status &&
        receipt?.gateVerification?.latestEvidenceKind === gateEvidence.evidence?.latestEvidenceKind &&
        receipt?.gateVerification?.latestHumanReviewed === gateEvidence.evidence?.latestHumanReviewed &&
        receipt?.gateVerification?.latestAutomationGenerated === gateEvidence.evidence?.latestAutomationGenerated,
      'gatePath=' + (receipt?.gateVerification?.gateReportPath ?? 'missing') +
        '; gateStatus=' +
        (gateEvidence.evidence?.status ?? 'missing') +
        '; latestKind=' +
        (gateEvidence.evidence?.latestEvidenceKind ?? 'missing') +
        '; latestHumanReviewed=' +
        (gateEvidence.evidence?.latestHumanReviewed ?? 'missing') +
        '; latestAutomation=' +
        (gateEvidence.evidence?.latestAutomationGenerated ?? 'missing')
    );
    const reviewChecks = receipt?.reviewChecks;
    push(
      checks,
      "Submitted human review checks are complete and locked",
      reviewChecks?.manualTestOpened === true &&
        reviewChecks.stableTaskRunCompleted === true &&
        reviewChecks.traceVisibleWithoutPrivateCot === true &&
        reviewChecks.correctionLoopReviewed === true &&
        reviewChecks.allManualStepsPassedWithNotes === true &&
        reviewChecks.manualReviewAttestationConfirmed === true &&
        reviewChecks.savedEvidenceKindHumanReview === true &&
        reviewChecks.savedEvidenceVerifiedByGate === true &&
        reviewChecks.packagingStillGated === true &&
        reviewChecks.releaseStillDoNotRelease === true &&
        reviewChecks.allSoftwareStillPaused === true &&
        reviewChecks.realModelNotAcceptedByThisReview === true,
      `manualTest=${reviewChecks?.manualTestOpened ?? "missing"}; evidence=${reviewChecks?.savedEvidenceKindHumanReview ??
        "missing"}; gate=${reviewChecks?.savedEvidenceVerifiedByGate ?? "missing"}; packaging=${
        reviewChecks?.packagingStillGated ?? "missing"
      }; release=${reviewChecks?.releaseStillDoNotRelease ?? "missing"}`
    );

    const stepResults = receipt?.stepResults ?? [];
    const everyRequiredStep = requiredStepIds.every((id) =>
      stepResults.some((step) => step.id === id && step.status === "passed" && hasText(step.note))
    );
    push(
      checks,
      "Submitted reviewer step results cover the full bounded flow",
      stepResults.length >= requiredStepIds.length && everyRequiredStep,
      `steps=${stepResults.length}; requiredMatched=${requiredStepIds.filter((id) =>
        stepResults.some((step) => step.id === id && step.status === "passed" && hasText(step.note))
      ).length}/${requiredStepIds.length}`
    );

    push(
      checks,
      "Submitted human acceptance receipt has an actionable next step",
      hasText(receipt?.nextActionRecommendation) &&
        (receipt?.humanAcceptanceDecision !== "blocked" || hasText(receipt.blockers?.blockingIssue)) &&
        (receipt?.humanAcceptanceDecision !== "ready_for_gate_verification" ||
          reviewChecks?.releaseStillDoNotRelease === true),
      `decision=${receipt?.humanAcceptanceDecision ?? "missing"}; nextAction=${hasText(
        receipt?.nextActionRecommendation
      )}; blocker=${hasText(receipt?.blockers?.blockingIssue)}`
    );
  }

  const passed = checks.filter((check) => check.pass).length;
  const validationStatus = passed === checks.length ? (isTemplate ? "template_ready" : "passed") : "failed";
  const validation = {
    responseMode: "human_acceptance_receipt_validation_json_v1",
    status: validationStatus,
    generatedAt: new Date().toISOString(),
    command: isTemplate
      ? "npm run verify:human-acceptance-receipt"
      : `npm run verify:human-acceptance-receipt -- --receipt ${path.relative(process.cwd(), receiptPath)}`,
    inputPath: path.relative(process.cwd(), receiptPath),
    mode: isTemplate ? "template" : "submitted_receipt",
    productScope: "bounded_core_teaching_loop",
    allSoftwareObjective: "paused",
    releaseDecision: "do_not_release",
    reviewOnly: true,
    accepted: false,
    packagingGated: true,
    canRelease: false,
    canActivateRealModel: false,
    passed,
    total: checks.length,
    checks,
    nextAction:
      validationStatus === "template_ready"
        ? "Give a copy of the template to the human acceptance reviewer; validate the filled copy with -- --receipt <path>."
        : validationStatus === "passed"
          ? "Use the submitted receipt as human-review evidence only, then run npm run verify:human-acceptance and release readiness checks separately."
          : "Fix the human acceptance receipt before using it for human acceptance follow-up."
  };

  fs.mkdirSync(artifactsDir, { recursive: true });
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(validation, null, 2));
  console.log(JSON.stringify(validation, null, 2));
  console.log(`\nHuman acceptance receipt validation written to ${outputPath}`);

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
