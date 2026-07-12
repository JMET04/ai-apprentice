import fs from "node:fs";
import path from "node:path";
import { visualLearningAcceptanceGate } from "../src/lib/teacher-acceptance";

const artifactsDir = path.join(process.cwd(), "artifacts", "productization");
const latestManualAcceptancePath = path.join(artifactsDir, "manual-acceptance-latest.json");
const humanAcceptanceGatePath = path.join(artifactsDir, "human-acceptance-gate.json");
const allowPending = process.argv.includes("--allow-pending");

type ManualAcceptanceEnvelope = {
  responseMode?: string;
  savedAt?: string;
  source?: string;
  evidenceKind?: string;
  humanReviewed?: boolean;
  automationGenerated?: boolean;
  classificationReason?: string;
  humanReviewEvidence?: {
    responseMode?: string;
    reviewerName?: string;
    attestation?: string;
    savedFrom?: string;
  };
  reviewOnly?: boolean;
  accepted?: boolean;
  packagingGated?: boolean;
  report?: {
    summary?: {
      readyForHumanTrial?: boolean;
      passed?: number;
      failed?: number;
      notRun?: number;
    };
    steps?: Array<{
      id?: string;
      title?: string;
      status?: string;
    }>;
  };
};

type GateCheck = {
  name: string;
  pass: boolean;
  evidence: string;
};

function readLatestManualAcceptance() {
  try {
    return JSON.parse(fs.readFileSync(latestManualAcceptancePath, "utf8")) as ManualAcceptanceEnvelope;
  } catch {
    return null;
  }
}

function push(checks: GateCheck[], name: string, pass: boolean, evidence: string) {
  checks.push({ name, pass, evidence });
}

function writeGateReceipt(args: {
  status: "passed" | "blocked_needs_human_review" | "failed";
  checks: GateCheck[];
  latestManualAcceptance: ManualAcceptanceEnvelope | null;
}) {
  const passed = args.checks.filter((check) => check.pass).length;
  const receipt = {
    responseMode: "human_acceptance_gate_json_v1",
    status: args.status,
    generatedAt: new Date().toISOString(),
    command: allowPending ? "npm run verify:human-acceptance -- --allow-pending" : "npm run verify:human-acceptance",
    allowPending,
    reportPath: path.join("artifacts", "productization", "human-acceptance-gate.json"),
    latestManualAcceptancePath: path.join("artifacts", "productization", "manual-acceptance-latest.json"),
    latestEvidenceKind: args.latestManualAcceptance?.evidenceKind ?? "not_saved_yet",
    latestHumanReviewed: args.latestManualAcceptance?.humanReviewed ?? false,
    latestAutomationGenerated: args.latestManualAcceptance?.automationGenerated ?? false,
    latestSavedAt: args.latestManualAcceptance?.savedAt ?? null,
    source: args.latestManualAcceptance?.source ?? null,
    passed,
    total: args.checks.length,
    checks: args.checks,
    nextRequiredAction:
      args.status === "passed"
        ? "Keep this receipt with the trial packet; it proves a real human_review pass exists while packaging remains locked."
        : "Run a real tester pass from /manual-test, enter reviewer name, pass every step, add per-step notes, confirm the manual-review attestation, save the evidence, then rerun npm run verify:human-acceptance.",
    productScope: "bounded_core_teaching_loop",
    allSoftwareObjective: "paused",
    releaseBoundary: {
      reviewOnly: true,
      accepted: false,
      packagingGated: true,
      status: visualLearningAcceptanceGate.status,
      reminder: "This human acceptance gate does not unlock packaging, release, rule enablement, or all-software scope."
    }
  };

  fs.mkdirSync(artifactsDir, { recursive: true });
  fs.writeFileSync(humanAcceptanceGatePath, JSON.stringify(receipt, null, 2));
  return receipt;
}

function main() {
  const checks: GateCheck[] = [];
  const latestManualAcceptance = readLatestManualAcceptance();
  const steps = latestManualAcceptance?.report?.steps ?? [];
  const failedSteps = steps.filter((step) => step.status === "failed");
  const notRunSteps = steps.filter((step) => !step.status || step.status === "not-run" || step.status === "not_run");

  push(
    checks,
    "Manual acceptance evidence has been saved",
    latestManualAcceptance?.responseMode === "manual_acceptance_saved_receipt_json_v1",
    latestManualAcceptance
      ? `source=${latestManualAcceptance.source}; savedAt=${latestManualAcceptance.savedAt}`
      : "manual-acceptance-latest.json is missing or unreadable"
  );

  push(
    checks,
    "Latest evidence is a real human review",
    latestManualAcceptance?.evidenceKind === "human_review" &&
      latestManualAcceptance.humanReviewed === true &&
      latestManualAcceptance.automationGenerated === false &&
      latestManualAcceptance.classificationReason === "valid_human_review_evidence",
    `evidenceKind=${latestManualAcceptance?.evidenceKind ?? "missing"}; humanReviewed=${
      latestManualAcceptance?.humanReviewed ?? "missing"
    }; automationGenerated=${latestManualAcceptance?.automationGenerated ?? "missing"}; classificationReason=${
      latestManualAcceptance?.classificationReason ?? "missing"
    }`
  );

  push(
    checks,
    "Human review evidence includes reviewer attestation",
    latestManualAcceptance?.humanReviewEvidence?.responseMode === "manual_test_workbench_human_review_evidence_v1" &&
      latestManualAcceptance.humanReviewEvidence.attestation === "human-reviewed-manual-test-workbench" &&
      latestManualAcceptance.humanReviewEvidence.savedFrom === "manual-test-workbench" &&
      Boolean(latestManualAcceptance.humanReviewEvidence.reviewerName?.trim()),
    `responseMode=${latestManualAcceptance?.humanReviewEvidence?.responseMode ?? "missing"}; reviewerName=${
      latestManualAcceptance?.humanReviewEvidence?.reviewerName ?? "missing"
    }; savedFrom=${latestManualAcceptance?.humanReviewEvidence?.savedFrom ?? "missing"}`
  );

  push(
    checks,
    "Manual report has no failed or unrun acceptance steps",
    steps.length > 0 && failedSteps.length === 0 && notRunSteps.length === 0,
    `steps=${steps.length}; failed=${failedSteps.length}; notRun=${notRunSteps.length}`
  );

  push(
    checks,
    "Manual summary remains ready for human trial",
    latestManualAcceptance?.report?.summary?.readyForHumanTrial === true &&
      (latestManualAcceptance.report.summary.failed ?? 0) === 0 &&
      (latestManualAcceptance.report.summary.notRun ?? 0) === 0,
    `readyForHumanTrial=${latestManualAcceptance?.report?.summary?.readyForHumanTrial ?? "missing"}; failed=${
      latestManualAcceptance?.report?.summary?.failed ?? "missing"
    }; notRun=${latestManualAcceptance?.report?.summary?.notRun ?? "missing"}`
  );

  push(
    checks,
    "Release boundary remains locked",
    latestManualAcceptance?.reviewOnly === true &&
      latestManualAcceptance.accepted === false &&
      latestManualAcceptance.packagingGated === true &&
      visualLearningAcceptanceGate.accepted === false &&
      visualLearningAcceptanceGate.packagingGated === true,
    `reportReviewOnly=${latestManualAcceptance?.reviewOnly ?? "missing"}; reportAccepted=${
      latestManualAcceptance?.accepted ?? "missing"
    }; reportPackagingGated=${latestManualAcceptance?.packagingGated ?? "missing"}; gateAccepted=${
      visualLearningAcceptanceGate.accepted
    }; gatePackagingGated=${visualLearningAcceptanceGate.packagingGated}`
  );

  const hasHumanReview = checks.every((check) => check.pass);
  const status = hasHumanReview ? "passed" : "blocked_needs_human_review";
  const receipt = writeGateReceipt({
    status,
    checks,
    latestManualAcceptance
  });

  console.log(JSON.stringify(receipt, null, 2));
  console.log(`\nHuman acceptance gate written to ${humanAcceptanceGatePath}`);

  if (!hasHumanReview && !allowPending) {
    process.exitCode = 1;
  }
}

main();

export {};
