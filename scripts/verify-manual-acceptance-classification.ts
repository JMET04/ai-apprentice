import fs from "node:fs";
import path from "node:path";

type ClassificationCheck = {
  name: string;
  pass: boolean;
  evidence: string;
};

const productArtifactsDir = path.join(process.cwd(), "artifacts", "productization");
const tempArtifactsDir = path.join(productArtifactsDir, "manual-acceptance-classification-temp");
const receiptPath = path.join(productArtifactsDir, "manual-acceptance-classification-verification.json");

function push(checks: ClassificationCheck[], name: string, pass: boolean, evidence: string) {
  checks.push({ name, pass, evidence });
}

function buildReport(args: { noteSuffix?: string; testerName?: string; firstStepStatus?: "passed" | "failed" }) {
  const firstStepStatus = args.firstStepStatus ?? "passed";
  const failed = firstStepStatus === "failed" ? 1 : 0;
  const passed = firstStepStatus === "passed" ? 2 : 1;

  return {
    format: "transparent_ai_apprentice_manual_acceptance_report_v1",
    generatedAt: new Date().toISOString(),
    summary: {
      passed,
      failed,
      notRun: 0,
      readyForHumanTrial: failed === 0
    },
    releaseBoundary: {
      reminder: "Manual acceptance does not unlock packaging, release, automatic execution, or all-software goals.",
      evidence: [
        { label: "accepted", value: "false" },
        { label: "packagingGated", value: "true" }
      ]
    },
    steps: [
      {
        id: "run-once",
        title: "Run once",
        role: "core execution",
        route: "/tasks/task-photo-travel-journal/run",
        status: firstStepStatus,
        expectedEvidence: "A visible structured result and trace.",
        stopIf: "No trace is visible.",
        note: `Observed run evidence.${args.noteSuffix ?? ""}`
      },
      {
        id: "review-evidence",
        title: "Review evidence",
        role: "teacher review",
        route: "/tasks/task-photo-travel-journal/review",
        status: "passed",
        expectedEvidence: "Packaging remains locked.",
        stopIf: "Packaging is unlocked.",
        note: `Observed locked review evidence.${args.noteSuffix ?? ""}`
      }
    ],
    testerNote: "Classification verification fixture.",
    testerName: args.testerName ?? "Test Reviewer"
  };
}

function buildHumanReviewEvidence(args: { reviewerName?: string; stepCount?: number; passed?: number; failed?: number; notRun?: number }) {
  return {
    responseMode: "manual_test_workbench_human_review_evidence_v1" as const,
    reviewedAt: new Date().toISOString(),
    reviewerName: args.reviewerName ?? "Test Reviewer",
    attestation: "human-reviewed-manual-test-workbench",
    savedFrom: "manual-test-workbench",
    stepCount: args.stepCount ?? 2,
    passed: args.passed ?? 2,
    failed: args.failed ?? 0,
    notRun: args.notRun ?? 0
  };
}

async function main() {
  fs.rmSync(tempArtifactsDir, { recursive: true, force: true });
  fs.mkdirSync(productArtifactsDir, { recursive: true });
  process.env.PRODUCT_ARTIFACTS_DIR = tempArtifactsDir;

  const { saveManualAcceptanceReport } = await import("../src/server/productization/manual-acceptance");
  const checks: ClassificationCheck[] = [];

  const automated = saveManualAcceptanceReport(buildReport({ noteSuffix: " automated" }), "manual-browser-smoke");
  push(
    checks,
    "Automation source cannot become human review",
    automated.evidenceKind === "automated_browser_smoke" &&
      automated.humanReviewed === false &&
      automated.automationGenerated === true &&
      automated.classificationReason === "source_marked_as_automation",
    `kind=${automated.evidenceKind}; humanReviewed=${automated.humanReviewed}; reason=${automated.classificationReason}`
  );

  const missingEvidence = saveManualAcceptanceReport(buildReport({ noteSuffix: " missing evidence" }), "manual-test-workbench");
  push(
    checks,
    "Manual source without attestation stays non-human",
    missingEvidence.evidenceKind === "legacy_unknown" &&
      missingEvidence.humanReviewed === false &&
      missingEvidence.automationGenerated === false &&
      missingEvidence.classificationReason === "missing_or_incomplete_human_review_evidence",
    `kind=${missingEvidence.evidenceKind}; humanReviewed=${missingEvidence.humanReviewed}; reason=${missingEvidence.classificationReason}`
  );

  const mismatchedEvidence = saveManualAcceptanceReport(
    buildReport({ noteSuffix: " mismatched evidence" }),
    "manual-test-workbench",
    buildHumanReviewEvidence({ stepCount: 99 })
  );
  push(
    checks,
    "Mismatched attestation stays non-human",
    mismatchedEvidence.evidenceKind === "legacy_unknown" &&
      mismatchedEvidence.humanReviewed === false &&
      mismatchedEvidence.classificationReason === "missing_or_incomplete_human_review_evidence",
    `kind=${mismatchedEvidence.evidenceKind}; stepCount=${mismatchedEvidence.humanReviewEvidence?.stepCount}; reason=${mismatchedEvidence.classificationReason}`
  );

  const failedReport = saveManualAcceptanceReport(
    buildReport({ noteSuffix: " failed step", firstStepStatus: "failed" }),
    "manual-test-workbench",
    buildHumanReviewEvidence({ passed: 1, failed: 1 })
  );
  push(
    checks,
    "Failed manual report cannot become human review",
    failedReport.evidenceKind === "legacy_unknown" &&
      failedReport.humanReviewed === false &&
      failedReport.classificationReason === "missing_or_incomplete_human_review_evidence",
    `kind=${failedReport.evidenceKind}; ready=${failedReport.report.summary?.readyForHumanTrial}; reason=${failedReport.classificationReason}`
  );

  const human = saveManualAcceptanceReport(
    buildReport({ noteSuffix: " valid human", testerName: "Human Tester" }),
    "manual-test-workbench",
    buildHumanReviewEvidence({ reviewerName: "Human Tester" })
  );
  push(
    checks,
    "Complete human attestation becomes human review",
    human.evidenceKind === "human_review" &&
      human.humanReviewed === true &&
      human.automationGenerated === false &&
      human.classificationReason === "valid_human_review_evidence" &&
      human.humanReviewEvidence?.attestation === "human-reviewed-manual-test-workbench" &&
      human.reviewOnly === true &&
      human.accepted === false &&
      human.packagingGated === true,
    `kind=${human.evidenceKind}; reviewer=${human.humanReviewEvidence?.reviewerName}; reason=${human.classificationReason}`
  );

  const latestPath = path.join(tempArtifactsDir, "manual-acceptance-latest.json");
  const latest = JSON.parse(fs.readFileSync(latestPath, "utf8")) as { evidenceKind?: string; classificationReason?: string };
  push(
    checks,
    "Temporary latest receipt reflects the valid final fixture",
    latest.evidenceKind === "human_review" && latest.classificationReason === "valid_human_review_evidence",
    `latestKind=${latest.evidenceKind}; latestReason=${latest.classificationReason}`
  );

  const passed = checks.filter((check) => check.pass).length;
  const receipt = {
    responseMode: "manual_acceptance_classification_verification_json_v1",
    status: passed === checks.length ? "passed" : "failed",
    generatedAt: new Date().toISOString(),
    command: "npm run verify:manual-acceptance-classification",
    tempArtifactsDir: path.join("artifacts", "productization", "manual-acceptance-classification-temp"),
    productScope: "bounded_core_teaching_loop",
    allSoftwareObjective: "paused",
    passed,
    total: checks.length,
    checks,
    releaseBoundary: {
      reviewOnly: true,
      accepted: false,
      packagingGated: true
    }
  };

  fs.writeFileSync(receiptPath, JSON.stringify(receipt, null, 2));
  console.log(JSON.stringify(receipt, null, 2));
  console.log(`\nManual acceptance classification receipt written to ${receiptPath}`);

  if (receipt.status !== "passed") {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

export {};
