import fs from "node:fs";
import path from "node:path";

export const productArtifactsDir = process.env.PRODUCT_ARTIFACTS_DIR ?? path.join(process.cwd(), "artifacts", "productization");
export const manualAcceptanceLatestReportName = "manual-acceptance-latest.json";
export const manualAcceptanceHistoryDir = path.join(productArtifactsDir, "manual-acceptance-history");
export const manualAcceptanceLatestReportPath = path.join(productArtifactsDir, manualAcceptanceLatestReportName);

export type ManualAcceptanceReport = {
  format?: string;
  generatedAt?: string;
  summary?: {
    readyForHumanTrial?: boolean;
    passed?: number;
    failed?: number;
    notRun?: number;
  };
  releaseBoundary?: {
    reminder?: string;
    evidence?: Array<{ label: string; value: string }>;
  };
  steps?: Array<{
    id?: string;
    title?: string;
    role?: string;
    route?: string;
    status?: string;
    expectedEvidence?: string;
    stopIf?: string;
    note?: string;
  }>;
  testerNote?: string;
  testerName?: string;
};

export type ManualAcceptanceEvidenceKind = "human_review" | "automated_browser_smoke" | "legacy_unknown";

export type HumanReviewEvidence = {
  responseMode?: "manual_test_workbench_human_review_evidence_v1";
  reviewedAt?: string;
  reviewerName?: string;
  attestation?: string;
  savedFrom?: string;
  stepCount?: number;
  passed?: number;
  failed?: number;
  notRun?: number;
};

export type SavedManualAcceptanceEnvelope = {
  responseMode: "manual_acceptance_saved_receipt_json_v1";
  savedAt: string;
  source: string;
  evidenceKind: ManualAcceptanceEvidenceKind;
  humanReviewed: boolean;
  automationGenerated: boolean;
  classificationReason: string;
  humanReviewEvidence?: HumanReviewEvidence;
  latestReportPath: string;
  historyReportPath: string;
  reviewOnly: true;
  accepted: false;
  packagingGated: true;
  report: ManualAcceptanceReport;
};

function assertReviewOnlyReport(report: ManualAcceptanceReport) {
  if (report.format !== "transparent_ai_apprentice_manual_acceptance_report_v1") {
    throw new Error("Unsupported manual acceptance report format.");
  }

  if (!report.releaseBoundary?.reminder?.includes("does not unlock packaging")) {
    throw new Error("Manual acceptance report must preserve the packaging lock reminder.");
  }

  const acceptedEvidence = report.releaseBoundary.evidence?.find((item) => item.label === "accepted");
  const packagingEvidence = report.releaseBoundary.evidence?.find((item) => item.label === "packagingGated");

  if (acceptedEvidence?.value !== "false" || packagingEvidence?.value !== "true") {
    throw new Error("Manual acceptance report must keep accepted=false and packagingGated=true.");
  }
}

function isAutomationSource(source: string) {
  return source === "manual-browser-smoke" || source.includes("smoke") || source.includes("automation");
}

function hasRealHumanReviewEvidence(report: ManualAcceptanceReport, evidence?: HumanReviewEvidence) {
  const reviewerName = evidence?.reviewerName?.trim() || report.testerName?.trim() || "";
  const steps = report.steps ?? [];
  const reviewedAtMs = Date.parse(evidence?.reviewedAt ?? "");

  return (
    evidence?.responseMode === "manual_test_workbench_human_review_evidence_v1" &&
    evidence.attestation === "human-reviewed-manual-test-workbench" &&
    evidence.savedFrom === "manual-test-workbench" &&
    reviewerName.length >= 2 &&
    Number.isFinite(reviewedAtMs) &&
    report.summary?.readyForHumanTrial === true &&
    report.summary.failed === 0 &&
    report.summary.notRun === 0 &&
    evidence.stepCount === steps.length &&
    evidence.passed === report.summary.passed &&
    evidence.failed === report.summary.failed &&
    evidence.notRun === report.summary.notRun &&
    steps.length > 0 &&
    steps.every((step) => step.status === "passed" && Boolean(step.note?.trim()))
  );
}

function classifyManualAcceptanceSource(
  source: string,
  report: ManualAcceptanceReport,
  humanReviewEvidence?: HumanReviewEvidence
): {
  evidenceKind: ManualAcceptanceEvidenceKind;
  humanReviewed: boolean;
  automationGenerated: boolean;
  classificationReason: string;
} {
  if (isAutomationSource(source)) {
    return {
      evidenceKind: "automated_browser_smoke",
      humanReviewed: false,
      automationGenerated: true,
      classificationReason: "source_marked_as_automation"
    };
  }

  if (hasRealHumanReviewEvidence(report, humanReviewEvidence)) {
    return {
      evidenceKind: "human_review",
      humanReviewed: true,
      automationGenerated: false,
      classificationReason: "valid_human_review_evidence"
    };
  }

  return {
    evidenceKind: "legacy_unknown",
    humanReviewed: false,
    automationGenerated: false,
    classificationReason: "missing_or_incomplete_human_review_evidence"
  };
}

export function readLatestManualAcceptanceEnvelope() {
  try {
    const envelope = JSON.parse(fs.readFileSync(manualAcceptanceLatestReportPath, "utf8")) as SavedManualAcceptanceEnvelope;
    return {
      ...envelope,
      evidenceKind: envelope.evidenceKind ?? "legacy_unknown",
      humanReviewed: envelope.humanReviewed ?? false,
      automationGenerated: envelope.automationGenerated ?? envelope.source.includes("smoke"),
      classificationReason:
        envelope.classificationReason ??
        (envelope.humanReviewed ? "legacy_human_review_without_evidence" : "legacy_missing_classification_reason")
    };
  } catch {
    return null;
  }
}

export function saveManualAcceptanceReport(
  report: ManualAcceptanceReport,
  source = "manual-test-page",
  humanReviewEvidence?: HumanReviewEvidence
) {
  assertReviewOnlyReport(report);

  const savedAt = new Date().toISOString();
  const fileStamp = savedAt.replace(/[:.]/g, "-");
  const historyReportPath = path.join(manualAcceptanceHistoryDir, `manual-acceptance-${fileStamp}.json`);
  const classification = classifyManualAcceptanceSource(source, report, humanReviewEvidence);
  const envelope: SavedManualAcceptanceEnvelope = {
    responseMode: "manual_acceptance_saved_receipt_json_v1",
    savedAt,
    source,
    ...classification,
    ...(humanReviewEvidence ? { humanReviewEvidence } : {}),
    latestReportPath: path.join("artifacts", "productization", manualAcceptanceLatestReportName),
    historyReportPath: path.join("artifacts", "productization", "manual-acceptance-history", path.basename(historyReportPath)),
    reviewOnly: true,
    accepted: false,
    packagingGated: true,
    report
  };

  fs.mkdirSync(productArtifactsDir, { recursive: true });
  fs.mkdirSync(manualAcceptanceHistoryDir, { recursive: true });
  fs.writeFileSync(manualAcceptanceLatestReportPath, JSON.stringify(envelope, null, 2));
  fs.writeFileSync(historyReportPath, JSON.stringify(envelope, null, 2));

  return envelope;
}
