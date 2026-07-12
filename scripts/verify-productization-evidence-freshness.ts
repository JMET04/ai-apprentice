import fs from "node:fs";
import path from "node:path";

type FreshnessCheck = {
  name: string;
  pass: boolean;
  evidence: string;
};

type JsonRecord = Record<string, unknown>;

const rootDir = process.cwd();
const artifactsDir = path.join(rootDir, "artifacts", "productization");
const receiptPath = path.join(artifactsDir, "productization-evidence-freshness.json");

function push(checks: FreshnessCheck[], name: string, pass: boolean, evidence: string) {
  checks.push({ name, pass, evidence });
}

function readJson(relativePath: string): JsonRecord | null {
  const fullPath = path.join(rootDir, relativePath);
  if (!fs.existsSync(fullPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(fullPath, "utf8")) as JsonRecord;
  } catch {
    return null;
  }
}

function generatedAt(value: JsonRecord | null): string | undefined {
  const raw = value?.generatedAt;
  return typeof raw === "string" ? raw : undefined;
}

function timeMs(value: string | undefined): number {
  const parsed = Date.parse(value ?? "");
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function isAtOrAfter(later: JsonRecord | null, earlier: JsonRecord | null): boolean {
  const laterMs = timeMs(generatedAt(later));
  const earlierMs = timeMs(generatedAt(earlier));
  return Number.isFinite(laterMs) && Number.isFinite(earlierMs) && laterMs >= earlierMs;
}

function evidencePair(laterName: string, later: JsonRecord | null, earlierName: string, earlier: JsonRecord | null): string {
  return `${laterName}=${generatedAt(later) ?? "missing"}; ${earlierName}=${generatedAt(earlier) ?? "missing"}`;
}

function fieldIs(record: JsonRecord | null, field: string, expected: unknown): boolean {
  return record?.[field] === expected;
}

function objectField(record: JsonRecord | null, field: string): JsonRecord | null {
  const raw = record?.[field];
  return raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as JsonRecord) : null;
}

function lockValue(record: JsonRecord | null, field: "accepted" | "packagingGated"): unknown {
  if (record && field in record) return record[field];
  return objectField(record, "boundary")?.[field];
}

function canReleaseLock(record: JsonRecord | null): boolean {
  if (record && "canRelease" in record) return record.canRelease === false;
  return statusOf(record) === "blocked_not_release_ready";
}

function canActivateRealModelLock(record: JsonRecord | null): boolean {
  if (record && "canActivateRealModel" in record) return record.canActivateRealModel === false;
  return true;
}

function lockEvidence(name: string, record: JsonRecord | null): string {
  return `${name}: releaseDecision=${String(record?.releaseDecision ?? "missing")}; allSoftwareObjective=${String(
    record?.allSoftwareObjective ?? "missing"
  )}; accepted=${String(lockValue(record, "accepted") ?? "missing")}; packagingGated=${String(
    lockValue(record, "packagingGated") ?? "missing"
  )}; canRelease=${String(record?.canRelease ?? (statusOf(record) === "blocked_not_release_ready" ? "blocked" : "missing"))}; canActivateRealModel=${String(
    record?.canActivateRealModel ?? "missing"
  )}`;
}

function preservesLocks(record: JsonRecord | null): boolean {
  return (
    fieldIs(record, "releaseDecision", "do_not_release") &&
    fieldIs(record, "allSoftwareObjective", "paused") &&
    lockValue(record, "accepted") === false &&
    lockValue(record, "packagingGated") === true &&
    canReleaseLock(record) &&
    canActivateRealModelLock(record)
  );
}

function statusOf(record: JsonRecord | null): string {
  const raw = record?.status;
  return typeof raw === "string" ? raw : "missing";
}

function main() {
  const checks: FreshnessCheck[] = [];

  const releaseReadiness = readJson("artifacts/productization/product-release-readiness.json");
  const blockerBoard = readJson("artifacts/productization/product-release-blocker-board.json");
  const blockerBoardVerification = readJson("artifacts/productization/product-release-blocker-board-verification.json");
  const operatorBrief = readJson("artifacts/productization/product-operator-brief.json");
  const operatorBriefVerification = readJson("artifacts/productization/product-operator-brief-verification.json");
  const statusSummary = readJson("artifacts/productization/product-status-summary.json");
  const statusSummaryVerification = readJson("artifacts/productization/product-status-summary-verification.json");
  const takeoverMatrix = readJson("artifacts/productization/product-takeover-decision-matrix.json");
  const takeoverMatrixVerification = readJson("artifacts/productization/product-takeover-decision-matrix-verification.json");
  const launchChecklist = readJson("artifacts/productization/productization-launch-checklist.json");
  const launchChecklistVerification = readJson("artifacts/productization/productization-launch-checklist-verification.json");
  const feedbackCollection = readJson("artifacts/productization/public-beta-feedback-collection.json");
  const feedbackCollectionVerification = readJson("artifacts/productization/public-beta-feedback-collection-verification.json");
  const followUpPlan = readJson("artifacts/productization/public-beta-follow-up-plan.json");
  const followUpPlanVerification = readJson("artifacts/productization/public-beta-follow-up-plan-verification.json");
  const humanAcceptanceReviewerKit = readJson("artifacts/productization/human-acceptance-reviewer-kit.json");
  const humanAcceptanceReviewerKitVerification = readJson("artifacts/productization/human-acceptance-reviewer-kit-verification.json");
  const humanAcceptanceReviewerInvite = readJson("artifacts/productization/human-acceptance-reviewer-invite.json");
  const humanAcceptanceReviewerInviteVerification = readJson("artifacts/productization/human-acceptance-reviewer-invite-verification.json");
  const humanAcceptanceReceiptValidation = readJson("artifacts/productization/human-acceptance-receipt-validation.json");
  const humanAcceptanceReturnIntakeVerification = readJson("artifacts/productization/human-acceptance-return-intake-verification.json");
  const realModelAdapterContract = readJson("artifacts/productization/real-model-adapter-contract-verification.json");
  const realModelTrialKit = readJson("artifacts/productization/real-model-trial-kit.json");
  const realModelTrialKitVerification = readJson("artifacts/productization/real-model-trial-kit-verification.json");
  const realModelTrialReceiptValidation = readJson("artifacts/productization/real-model-trial-receipt-validation.json");
  const realModelTrialReturnIntakeVerification = readJson("artifacts/productization/real-model-trial-return-intake-verification.json");
  const firstRealTesterLaunch = readJson("artifacts/productization/first-real-tester-launch.json");
  const firstRealTesterLaunchVerification = readJson("artifacts/productization/first-real-tester-launch-verification.json");
  const firstRealTesterDispatchPacket = readJson("artifacts/productization/first-real-tester-dispatch-packet.json");
  const firstRealTesterDispatchPacketVerification = readJson("artifacts/productization/first-real-tester-dispatch-packet-verification.json");
  const firstRealTesterSendBundle = readJson("artifacts/productization/first-real-tester-send-bundle.json");
  const firstRealTesterSendBundleVerification = readJson("artifacts/productization/first-real-tester-send-bundle-verification.json");
  const firstRealTesterSendReceiptTemplate = readJson("artifacts/productization/first-real-tester-send-receipt.template.json");
  const firstRealTesterSendReceiptTemplateVerification = readJson("artifacts/productization/first-real-tester-send-receipt-template-verification.json");
  const firstRealTesterContactReadiness = readJson("artifacts/productization/first-real-tester-contact-readiness.json");
  const firstRealTesterContactReadinessVerification = readJson("artifacts/productization/first-real-tester-contact-readiness-verification.json");
  const firstRealTesterSendExecutionBrief = readJson("artifacts/productization/first-real-tester-send-execution-brief.json");
  const firstRealTesterSendExecutionBriefVerification = readJson("artifacts/productization/first-real-tester-send-execution-brief-verification.json");
  const firstRealTesterReturnWorkbench = readJson("artifacts/productization/first-real-tester-return-workbench.json");
  const firstRealTesterReturnWorkbenchVerification = readJson("artifacts/productization/first-real-tester-return-workbench-verification.json");
  const firstRealTesterReturnGate = readJson("artifacts/productization/first-real-tester-return-gate.json");
  const firstRealTesterReturnGateVerification = readJson("artifacts/productization/first-real-tester-return-gate-verification.json");
  const firstRealTesterFinalGoNoGo = readJson("artifacts/productization/first-real-tester-final-go-no-go.json");
  const firstRealTesterFinalGoNoGoVerification = readJson("artifacts/productization/first-real-tester-final-go-no-go-verification.json");

  push(
    checks,
    "Core productization artifacts exist and carry generatedAt timestamps",
    [
      releaseReadiness,
      blockerBoard,
      blockerBoardVerification,
      operatorBrief,
      operatorBriefVerification,
      statusSummary,
      statusSummaryVerification,
      takeoverMatrix,
      takeoverMatrixVerification,
      launchChecklist,
      launchChecklistVerification,
      feedbackCollection,
      feedbackCollectionVerification,
      followUpPlan,
      followUpPlanVerification,
      humanAcceptanceReviewerKit,
      humanAcceptanceReviewerKitVerification,
      humanAcceptanceReviewerInvite,
      humanAcceptanceReviewerInviteVerification,
      humanAcceptanceReceiptValidation,
      humanAcceptanceReturnIntakeVerification,
      realModelAdapterContract,
      realModelTrialKit,
      realModelTrialKitVerification,
      realModelTrialReceiptValidation,
      realModelTrialReturnIntakeVerification,
      firstRealTesterLaunch,
      firstRealTesterLaunchVerification,
      firstRealTesterDispatchPacket,
      firstRealTesterDispatchPacketVerification,
      firstRealTesterSendBundle,
      firstRealTesterSendBundleVerification,
      firstRealTesterSendReceiptTemplate,
      firstRealTesterSendReceiptTemplateVerification,
      firstRealTesterContactReadiness,
      firstRealTesterContactReadinessVerification,
      firstRealTesterSendExecutionBrief,
      firstRealTesterSendExecutionBriefVerification,
      firstRealTesterReturnWorkbench,
      firstRealTesterReturnWorkbenchVerification,
      firstRealTesterReturnGate,
      firstRealTesterReturnGateVerification,
      firstRealTesterFinalGoNoGo,
      firstRealTesterFinalGoNoGoVerification
    ].every((record) => Number.isFinite(timeMs(generatedAt(record)))),
    `release=${generatedAt(releaseReadiness) ?? "missing"}; board=${generatedAt(blockerBoard) ?? "missing"}; brief=${generatedAt(
      operatorBrief
    ) ?? "missing"}; summary=${generatedAt(statusSummary) ?? "missing"}; takeover=${generatedAt(takeoverMatrix) ?? "missing"}; launch=${generatedAt(
      launchChecklist
    ) ?? "missing"}; firstRealFinal=${generatedAt(firstRealTesterFinalGoNoGo) ?? "missing"}`
  );

  push(
    checks,
    "Release readiness is refreshed before blocker board",
    isAtOrAfter(blockerBoard, releaseReadiness),
    evidencePair("blockerBoard", blockerBoard, "releaseReadiness", releaseReadiness)
  );

  push(
    checks,
    "Operator brief is refreshed before status summary",
    isAtOrAfter(statusSummary, operatorBrief),
    evidencePair("statusSummary", statusSummary, "operatorBrief", operatorBrief)
  );

  push(
    checks,
    "Status summary is refreshed after release readiness and blocker board",
    isAtOrAfter(statusSummary, releaseReadiness) && isAtOrAfter(statusSummary, blockerBoard),
    `${evidencePair("statusSummary", statusSummary, "releaseReadiness", releaseReadiness)}; ${evidencePair(
      "statusSummary",
      statusSummary,
      "blockerBoard",
      blockerBoard
    )}`
  );

  push(
    checks,
    "Takeover matrix is refreshed after status summary",
    isAtOrAfter(takeoverMatrix, statusSummary),
    evidencePair("takeoverMatrix", takeoverMatrix, "statusSummary", statusSummary)
  );

  push(
    checks,
    "Verification receipts are newer than the artifacts they verify",
    isAtOrAfter(blockerBoardVerification, blockerBoard) &&
      isAtOrAfter(operatorBriefVerification, operatorBrief) &&
      isAtOrAfter(statusSummaryVerification, statusSummary) &&
      isAtOrAfter(takeoverMatrixVerification, takeoverMatrix) &&
      isAtOrAfter(launchChecklistVerification, launchChecklist) &&
      isAtOrAfter(feedbackCollectionVerification, feedbackCollection) &&
      isAtOrAfter(followUpPlanVerification, followUpPlan) &&
      isAtOrAfter(humanAcceptanceReviewerKitVerification, humanAcceptanceReviewerKit) &&
      isAtOrAfter(humanAcceptanceReviewerInviteVerification, humanAcceptanceReviewerInvite) &&
      isAtOrAfter(realModelTrialKitVerification, realModelTrialKit),
    `${evidencePair("boardVerification", blockerBoardVerification, "board", blockerBoard)}; ${evidencePair(
      "briefVerification",
      operatorBriefVerification,
      "brief",
      operatorBrief
    )}; ${evidencePair("summaryVerification", statusSummaryVerification, "summary", statusSummary)}; ${evidencePair("takeoverVerification", takeoverMatrixVerification, "takeover", takeoverMatrix)}; ${evidencePair("launchChecklistVerification", launchChecklistVerification, "launchChecklist", launchChecklist)}; ${evidencePair(
      "feedbackVerification",
      feedbackCollectionVerification,
      "feedbackCollection",
      feedbackCollection
    )}; ${evidencePair("followUpVerification", followUpPlanVerification, "followUpPlan", followUpPlan)}; ${evidencePair("humanReviewerKitVerification", humanAcceptanceReviewerKitVerification, "humanReviewerKit", humanAcceptanceReviewerKit)}; ${evidencePair("humanReviewerInviteVerification", humanAcceptanceReviewerInviteVerification, "humanReviewerInvite", humanAcceptanceReviewerInvite)}; ${evidencePair("realModelTrialKitVerification", realModelTrialKitVerification, "realModelTrialKit", realModelTrialKit)}`
  );

  push(
    checks,
    "Controlled launch checklist is refreshed after takeover matrix",
    isAtOrAfter(launchChecklist, takeoverMatrix) &&
      isAtOrAfter(launchChecklistVerification, launchChecklist) &&
      statusOf(launchChecklist) === "ready_for_controlled_launch" &&
      statusOf(launchChecklistVerification) === "passed" &&
      preservesLocks(launchChecklist) &&
      preservesLocks(launchChecklistVerification),
    `${evidencePair("launchChecklist", launchChecklist, "takeoverMatrix", takeoverMatrix)}; ${evidencePair(
      "launchChecklistVerification",
      launchChecklistVerification,
      "launchChecklist",
      launchChecklist
    )}; ${lockEvidence("launchChecklist", launchChecklist)}; ${lockEvidence("launchChecklistVerification", launchChecklistVerification)}`
  );
  push(
    checks,
    "First real tester handoff chain is refreshed through final go/no-go",
    isAtOrAfter(firstRealTesterLaunch, launchChecklist) &&
      isAtOrAfter(firstRealTesterLaunchVerification, firstRealTesterLaunch) &&
      isAtOrAfter(firstRealTesterDispatchPacket, firstRealTesterLaunch) &&
      isAtOrAfter(firstRealTesterDispatchPacketVerification, firstRealTesterDispatchPacket) &&
      isAtOrAfter(firstRealTesterSendBundle, firstRealTesterDispatchPacket) &&
      isAtOrAfter(firstRealTesterSendBundleVerification, firstRealTesterSendBundle) &&
      isAtOrAfter(firstRealTesterSendReceiptTemplate, firstRealTesterSendBundle) &&
      isAtOrAfter(firstRealTesterSendReceiptTemplateVerification, firstRealTesterSendReceiptTemplate) &&
      isAtOrAfter(firstRealTesterContactReadiness, firstRealTesterSendReceiptTemplate) &&
      isAtOrAfter(firstRealTesterContactReadinessVerification, firstRealTesterContactReadiness) &&
      isAtOrAfter(firstRealTesterSendExecutionBrief, firstRealTesterContactReadiness) &&
      isAtOrAfter(firstRealTesterSendExecutionBriefVerification, firstRealTesterSendExecutionBrief) &&
      isAtOrAfter(firstRealTesterReturnWorkbench, firstRealTesterSendExecutionBrief) &&
      isAtOrAfter(firstRealTesterReturnWorkbenchVerification, firstRealTesterReturnWorkbench) &&
      isAtOrAfter(firstRealTesterReturnGate, firstRealTesterReturnWorkbench) &&
      isAtOrAfter(firstRealTesterReturnGateVerification, firstRealTesterReturnGate) &&
      isAtOrAfter(firstRealTesterFinalGoNoGo, firstRealTesterReturnGate) &&
      isAtOrAfter(firstRealTesterFinalGoNoGoVerification, firstRealTesterFinalGoNoGo) &&
      statusOf(firstRealTesterLaunch) === "ready_to_invite_one_bounded_real_tester_or_reviewer" &&
      statusOf(firstRealTesterLaunchVerification) === "passed" &&
      statusOf(firstRealTesterDispatchPacket) === "ready_to_send_one_lane" &&
      statusOf(firstRealTesterDispatchPacketVerification) === "passed" &&
      statusOf(firstRealTesterSendBundle) === "ready_to_send_chosen_lane" &&
      statusOf(firstRealTesterSendBundleVerification) === "passed" &&
      statusOf(firstRealTesterSendReceiptTemplate) === "template_ready" &&
      statusOf(firstRealTesterSendReceiptTemplateVerification) === "passed" &&
      statusOf(firstRealTesterContactReadiness) === "ready_to_contact_first_external_person" &&
      statusOf(firstRealTesterContactReadinessVerification) === "passed" &&
      statusOf(firstRealTesterSendExecutionBrief) === "ready_for_manual_send_execution" &&
      statusOf(firstRealTesterSendExecutionBriefVerification) === "passed" &&
      statusOf(firstRealTesterReturnWorkbench) === "ready_to_process_exactly_one_first_return" &&
      statusOf(firstRealTesterReturnWorkbenchVerification) === "passed" &&
      statusOf(firstRealTesterReturnGate) === "waiting_for_first_return" &&
      statusOf(firstRealTesterReturnGateVerification) === "passed" &&
      statusOf(firstRealTesterFinalGoNoGo) === "ready_for_one_manual_send" &&
      statusOf(firstRealTesterFinalGoNoGoVerification) === "passed" &&
      fieldIs(firstRealTesterFinalGoNoGo, "actualSendPerformed", false) &&
      fieldIs(firstRealTesterFinalGoNoGoVerification, "actualSendPerformed", false),
    `${evidencePair("firstRealLaunch", firstRealTesterLaunch, "launchChecklist", launchChecklist)}; ${evidencePair(
      "firstRealDispatch",
      firstRealTesterDispatchPacket,
      "firstRealLaunch",
      firstRealTesterLaunch
    )}; ${evidencePair("firstRealSendBundle", firstRealTesterSendBundle, "firstRealDispatch", firstRealTesterDispatchPacket)}; ${evidencePair(
      "firstRealContact",
      firstRealTesterContactReadiness,
      "firstRealSendReceipt",
      firstRealTesterSendReceiptTemplate
    )}; ${evidencePair(
      "firstRealExecution",
      firstRealTesterSendExecutionBrief,
      "firstRealContact",
      firstRealTesterContactReadiness
    )}; ${evidencePair(
      "firstRealReturnWorkbench",
      firstRealTesterReturnWorkbench,
      "firstRealExecution",
      firstRealTesterSendExecutionBrief
    )}; ${evidencePair("firstRealReturnGate", firstRealTesterReturnGate, "firstRealReturnWorkbench", firstRealTesterReturnWorkbench)}; ${evidencePair(
      "firstRealFinalGoNoGo",
      firstRealTesterFinalGoNoGo,
      "firstRealReturnGate",
      firstRealTesterReturnGate
    )}; actualSend=${String(firstRealTesterFinalGoNoGo?.actualSendPerformed ?? "missing")}`
  );

  push(
    checks,
    "First real tester handoff chain preserves release locks",
    [
      firstRealTesterLaunch,
      firstRealTesterLaunchVerification,
      firstRealTesterDispatchPacket,
      firstRealTesterDispatchPacketVerification,
      firstRealTesterSendBundle,
      firstRealTesterSendBundleVerification,
      firstRealTesterSendReceiptTemplate,
      firstRealTesterSendReceiptTemplateVerification,
      firstRealTesterContactReadiness,
      firstRealTesterContactReadinessVerification,
      firstRealTesterSendExecutionBrief,
      firstRealTesterSendExecutionBriefVerification,
      firstRealTesterReturnWorkbench,
      firstRealTesterReturnWorkbenchVerification,
      firstRealTesterReturnGate,
      firstRealTesterReturnGateVerification,
      firstRealTesterFinalGoNoGo,
      firstRealTesterFinalGoNoGoVerification
    ].every((record) => preservesLocks(record)),
    [
      lockEvidence("firstRealLaunch", firstRealTesterLaunch),
      lockEvidence("firstRealLaunchVerification", firstRealTesterLaunchVerification),
      lockEvidence("firstRealDispatch", firstRealTesterDispatchPacket),
      lockEvidence("firstRealDispatchVerification", firstRealTesterDispatchPacketVerification),
      lockEvidence("firstRealSendBundle", firstRealTesterSendBundle),
      lockEvidence("firstRealSendBundleVerification", firstRealTesterSendBundleVerification),
      lockEvidence("firstRealSendReceipt", firstRealTesterSendReceiptTemplate),
      lockEvidence("firstRealSendReceiptVerification", firstRealTesterSendReceiptTemplateVerification),
      lockEvidence("firstRealContact", firstRealTesterContactReadiness),
      lockEvidence("firstRealContactVerification", firstRealTesterContactReadinessVerification),
      lockEvidence("firstRealExecution", firstRealTesterSendExecutionBrief),
      lockEvidence("firstRealExecutionVerification", firstRealTesterSendExecutionBriefVerification),
      lockEvidence("firstRealReturnWorkbench", firstRealTesterReturnWorkbench),
      lockEvidence("firstRealReturnWorkbenchVerification", firstRealTesterReturnWorkbenchVerification),
      lockEvidence("firstRealReturnGate", firstRealTesterReturnGate),
      lockEvidence("firstRealReturnGateVerification", firstRealTesterReturnGateVerification),
      lockEvidence("firstRealFinalGoNoGo", firstRealTesterFinalGoNoGo),
      lockEvidence("firstRealFinalGoNoGoVerification", firstRealTesterFinalGoNoGoVerification)
    ].join("; ")
  );

  push(
    checks,
    "Public beta feedback follow-up is generated from the latest collected feedback",
    isAtOrAfter(followUpPlan, feedbackCollection),
    evidencePair("followUpPlan", followUpPlan, "feedbackCollection", feedbackCollection)
  );

  push(
    checks,
    "Human acceptance launch materials are refreshed after release readiness",
    isAtOrAfter(humanAcceptanceReviewerKit, releaseReadiness) &&
      isAtOrAfter(humanAcceptanceReviewerKitVerification, humanAcceptanceReviewerKit) &&
      isAtOrAfter(humanAcceptanceReviewerInvite, humanAcceptanceReviewerKit) &&
      isAtOrAfter(humanAcceptanceReviewerInviteVerification, humanAcceptanceReviewerInvite) &&
      Number.isFinite(timeMs(generatedAt(humanAcceptanceReceiptValidation))) &&
      Number.isFinite(timeMs(generatedAt(humanAcceptanceReturnIntakeVerification))) &&
      fieldIs(humanAcceptanceReviewerKit, "status", "ready_for_reviewer") &&
      fieldIs(humanAcceptanceReviewerKitVerification, "status", "passed") &&
      fieldIs(humanAcceptanceReviewerInvite, "status", "ready_to_invite_reviewer") &&
      fieldIs(humanAcceptanceReviewerInviteVerification, "status", "passed") &&
      fieldIs(humanAcceptanceReceiptValidation, "status", "template_ready") &&
      fieldIs(humanAcceptanceReturnIntakeVerification, "status", "passed"),
    `${evidencePair("humanReviewerKit", humanAcceptanceReviewerKit, "releaseReadiness", releaseReadiness)}; ${evidencePair(
      "humanReviewerKitVerification",
      humanAcceptanceReviewerKitVerification,
      "humanReviewerKit",
      humanAcceptanceReviewerKit
    )}; ${evidencePair("humanReviewerInvite", humanAcceptanceReviewerInvite, "humanReviewerKit", humanAcceptanceReviewerKit)}; ${evidencePair("humanReviewerInviteVerification", humanAcceptanceReviewerInviteVerification, "humanReviewerInvite", humanAcceptanceReviewerInvite)}; receiptValidation=${generatedAt(humanAcceptanceReceiptValidation) ?? "missing"}; returnIntake=${generatedAt(
      humanAcceptanceReturnIntakeVerification
    ) ?? "missing"}`
  );

  push(
    checks,
    "Human acceptance launch materials preserve review-only locks",
    fieldIs(humanAcceptanceReviewerKit, "releaseDecision", "do_not_release") &&
      fieldIs(humanAcceptanceReviewerKit, "allSoftwareObjective", "paused") &&
      fieldIs(humanAcceptanceReviewerKit, "accepted", false) &&
      fieldIs(humanAcceptanceReviewerKit, "packagingGated", true) &&
      fieldIs(humanAcceptanceReviewerKit, "canRelease", false) &&
      fieldIs(humanAcceptanceReviewerKit, "canActivateRealModel", false) &&
      fieldIs(humanAcceptanceReviewerKitVerification, "releaseDecision", "do_not_release") &&
      fieldIs(humanAcceptanceReviewerKitVerification, "accepted", false) &&
      fieldIs(humanAcceptanceReviewerKitVerification, "packagingGated", true) &&
      fieldIs(humanAcceptanceReviewerKitVerification, "canRelease", false) &&
      fieldIs(humanAcceptanceReviewerKitVerification, "canActivateRealModel", false) &&
      fieldIs(humanAcceptanceReviewerInvite, "releaseDecision", "do_not_release") &&
      fieldIs(humanAcceptanceReviewerInvite, "allSoftwareObjective", "paused") &&
      fieldIs(humanAcceptanceReviewerInvite, "accepted", false) &&
      fieldIs(humanAcceptanceReviewerInvite, "packagingGated", true) &&
      fieldIs(humanAcceptanceReviewerInvite, "canRelease", false) &&
      fieldIs(humanAcceptanceReviewerInvite, "canActivateRealModel", false) &&
      fieldIs(humanAcceptanceReviewerInviteVerification, "releaseDecision", "do_not_release") &&
      fieldIs(humanAcceptanceReviewerInviteVerification, "accepted", false) &&
      fieldIs(humanAcceptanceReviewerInviteVerification, "packagingGated", true) &&
      fieldIs(humanAcceptanceReviewerInviteVerification, "canRelease", false) &&
      fieldIs(humanAcceptanceReviewerInviteVerification, "canActivateRealModel", false) &&
      fieldIs(humanAcceptanceReceiptValidation, "releaseDecision", "do_not_release") &&
      fieldIs(humanAcceptanceReceiptValidation, "accepted", false) &&
      fieldIs(humanAcceptanceReceiptValidation, "packagingGated", true) &&
      fieldIs(humanAcceptanceReceiptValidation, "canRelease", false) &&
      fieldIs(humanAcceptanceReceiptValidation, "canActivateRealModel", false) &&
      fieldIs(humanAcceptanceReturnIntakeVerification, "releaseDecision", "do_not_release") &&
      fieldIs(humanAcceptanceReturnIntakeVerification, "accepted", false) &&
      fieldIs(humanAcceptanceReturnIntakeVerification, "packagingGated", true) &&
      fieldIs(humanAcceptanceReturnIntakeVerification, "canRelease", false) &&
      fieldIs(humanAcceptanceReturnIntakeVerification, "canActivateRealModel", false),
    [
      lockEvidence("humanReviewerKit", humanAcceptanceReviewerKit),
      lockEvidence("humanReviewerKitVerification", humanAcceptanceReviewerKitVerification),
      lockEvidence("humanReviewerInvite", humanAcceptanceReviewerInvite),
      lockEvidence("humanReviewerInviteVerification", humanAcceptanceReviewerInviteVerification),
      lockEvidence("humanReceiptValidation", humanAcceptanceReceiptValidation),
      lockEvidence("humanReturnIntake", humanAcceptanceReturnIntakeVerification)
    ].join("; ")
  );

  push(
    checks,
    "Real model trial launch materials are refreshed after release readiness",
    isAtOrAfter(realModelAdapterContract, releaseReadiness) &&
      isAtOrAfter(realModelTrialKit, realModelAdapterContract) &&
      isAtOrAfter(realModelTrialKitVerification, realModelTrialKit) &&
      Number.isFinite(timeMs(generatedAt(realModelTrialReceiptValidation))) &&
      Number.isFinite(timeMs(generatedAt(realModelTrialReturnIntakeVerification))) &&
      fieldIs(realModelAdapterContract, "status", "passed") &&
      fieldIs(realModelTrialKit, "status", "ready_for_real_model_trial_planning") &&
      fieldIs(realModelTrialKitVerification, "status", "passed") &&
      fieldIs(realModelTrialReceiptValidation, "status", "template_ready") &&
      fieldIs(realModelTrialReturnIntakeVerification, "status", "passed"),
    `${evidencePair("realModelAdapterContract", realModelAdapterContract, "releaseReadiness", releaseReadiness)}; ${evidencePair(
      "realModelTrialKit",
      realModelTrialKit,
      "realModelAdapterContract",
      realModelAdapterContract
    )}; ${evidencePair(
      "realModelTrialKitVerification",
      realModelTrialKitVerification,
      "realModelTrialKit",
      realModelTrialKit
    )}; receiptValidation=${generatedAt(realModelTrialReceiptValidation) ?? "missing"}; returnIntake=${generatedAt(
      realModelTrialReturnIntakeVerification
    ) ?? "missing"}`
  );

  push(
    checks,
    "Real model trial launch materials preserve inactive-provider locks",
    fieldIs(realModelAdapterContract, "releaseDecision", "do_not_release") &&
      fieldIs(realModelAdapterContract, "allSoftwareObjective", "paused") &&
      fieldIs(realModelAdapterContract, "accepted", false) &&
      fieldIs(realModelAdapterContract, "packagingGated", true) &&
      fieldIs(realModelAdapterContract, "realNetworkUsed", false) &&
      fieldIs(realModelAdapterContract, "realProviderAccepted", false) &&
      fieldIs(realModelAdapterContract, "canActivateRealModel", false) &&
      fieldIs(realModelTrialKit, "releaseDecision", "do_not_release") &&
      fieldIs(realModelTrialKit, "allSoftwareObjective", "paused") &&
      fieldIs(realModelTrialKit, "accepted", false) &&
      fieldIs(realModelTrialKit, "packagingGated", true) &&
      fieldIs(realModelTrialKit, "canActivateRealModel", false) &&
      fieldIs(realModelTrialKitVerification, "releaseDecision", "do_not_release") &&
      fieldIs(realModelTrialKitVerification, "accepted", false) &&
      fieldIs(realModelTrialKitVerification, "packagingGated", true) &&
      fieldIs(realModelTrialKitVerification, "canActivateRealModel", false) &&
      fieldIs(realModelTrialReceiptValidation, "releaseDecision", "do_not_release") &&
      fieldIs(realModelTrialReceiptValidation, "accepted", false) &&
      fieldIs(realModelTrialReceiptValidation, "packagingGated", true) &&
      fieldIs(realModelTrialReceiptValidation, "canActivateRealModel", false) &&
      fieldIs(realModelTrialReturnIntakeVerification, "releaseDecision", "do_not_release") &&
      fieldIs(realModelTrialReturnIntakeVerification, "accepted", false) &&
      fieldIs(realModelTrialReturnIntakeVerification, "packagingGated", true) &&
      fieldIs(realModelTrialReturnIntakeVerification, "canActivateRealModel", false),
    [
      lockEvidence("realModelAdapterContract", realModelAdapterContract),
      lockEvidence("realModelTrialKit", realModelTrialKit),
      lockEvidence("realModelTrialKitVerification", realModelTrialKitVerification),
      lockEvidence("realModelTrialReceiptValidation", realModelTrialReceiptValidation),
      lockEvidence("realModelTrialReturnIntake", realModelTrialReturnIntakeVerification)
    ].join("; ")
  );

  push(
    checks,
    "All core handoff artifacts preserve release locks",
    preservesLocks(releaseReadiness) &&
      preservesLocks(blockerBoard) &&
      preservesLocks(operatorBrief) &&
      preservesLocks(statusSummary) &&
      preservesLocks(takeoverMatrix) &&
      preservesLocks(launchChecklist) &&
      preservesLocks(launchChecklistVerification) &&
      preservesLocks(realModelAdapterContract) &&
      preservesLocks(realModelTrialKit) &&
      preservesLocks(realModelTrialKitVerification) &&
      preservesLocks(realModelTrialReceiptValidation) &&
      preservesLocks(realModelTrialReturnIntakeVerification) &&
      preservesLocks(firstRealTesterLaunch) &&
      preservesLocks(firstRealTesterLaunchVerification) &&
      preservesLocks(firstRealTesterDispatchPacket) &&
      preservesLocks(firstRealTesterDispatchPacketVerification) &&
      preservesLocks(firstRealTesterSendBundle) &&
      preservesLocks(firstRealTesterSendBundleVerification) &&
      preservesLocks(firstRealTesterSendReceiptTemplate) &&
      preservesLocks(firstRealTesterSendReceiptTemplateVerification) &&
      preservesLocks(firstRealTesterContactReadiness) &&
      preservesLocks(firstRealTesterContactReadinessVerification) &&
      preservesLocks(firstRealTesterSendExecutionBrief) &&
      preservesLocks(firstRealTesterSendExecutionBriefVerification) &&
      preservesLocks(firstRealTesterReturnWorkbench) &&
      preservesLocks(firstRealTesterReturnWorkbenchVerification) &&
      preservesLocks(firstRealTesterReturnGate) &&
      preservesLocks(firstRealTesterReturnGateVerification) &&
      preservesLocks(firstRealTesterFinalGoNoGo) &&
      preservesLocks(firstRealTesterFinalGoNoGoVerification),
    [
      lockEvidence("releaseReadiness", releaseReadiness),
      lockEvidence("blockerBoard", blockerBoard),
      lockEvidence("operatorBrief", operatorBrief),
      lockEvidence("statusSummary", statusSummary),
      lockEvidence("takeoverMatrix", takeoverMatrix),
      lockEvidence("launchChecklist", launchChecklist),
      lockEvidence("launchChecklistVerification", launchChecklistVerification),
      lockEvidence("realModelAdapterContract", realModelAdapterContract),
      lockEvidence("realModelTrialKit", realModelTrialKit),
      lockEvidence("realModelTrialKitVerification", realModelTrialKitVerification),
      lockEvidence("realModelTrialReceiptValidation", realModelTrialReceiptValidation),
      lockEvidence("realModelTrialReturnIntake", realModelTrialReturnIntakeVerification),
      lockEvidence("firstRealLaunch", firstRealTesterLaunch),
      lockEvidence("firstRealLaunchVerification", firstRealTesterLaunchVerification),
      lockEvidence("firstRealDispatch", firstRealTesterDispatchPacket),
      lockEvidence("firstRealDispatchVerification", firstRealTesterDispatchPacketVerification),
      lockEvidence("firstRealSendBundle", firstRealTesterSendBundle),
      lockEvidence("firstRealSendBundleVerification", firstRealTesterSendBundleVerification),
      lockEvidence("firstRealSendReceipt", firstRealTesterSendReceiptTemplate),
      lockEvidence("firstRealSendReceiptVerification", firstRealTesterSendReceiptTemplateVerification),
      lockEvidence("firstRealContact", firstRealTesterContactReadiness),
      lockEvidence("firstRealContactVerification", firstRealTesterContactReadinessVerification),
      lockEvidence("firstRealExecution", firstRealTesterSendExecutionBrief),
      lockEvidence("firstRealExecutionVerification", firstRealTesterSendExecutionBriefVerification),
      lockEvidence("firstRealReturnWorkbench", firstRealTesterReturnWorkbench),
      lockEvidence("firstRealReturnWorkbenchVerification", firstRealTesterReturnWorkbenchVerification),
      lockEvidence("firstRealReturnGate", firstRealTesterReturnGate),
      lockEvidence("firstRealReturnGateVerification", firstRealTesterReturnGateVerification),
      lockEvidence("firstRealFinalGoNoGo", firstRealTesterFinalGoNoGo),
      lockEvidence("firstRealFinalGoNoGoVerification", firstRealTesterFinalGoNoGoVerification)
    ].join("; ")
  );

  push(
    checks,
    "Current status remains bounded beta only, not release ready",
    statusOf(releaseReadiness) === "blocked_not_release_ready" &&
      statusOf(blockerBoard) === "ready_for_blocker_resolution" &&
      statusOf(operatorBrief) === "ready_for_operator_handoff" &&
      statusOf(statusSummary) === "ready_for_bounded_beta_not_release" &&
      statusOf(takeoverMatrix) === "ready_for_takeover" &&
      statusOf(launchChecklist) === "ready_for_controlled_launch" &&
      statusOf(firstRealTesterFinalGoNoGo) === "ready_for_one_manual_send" &&
      fieldIs(firstRealTesterFinalGoNoGo, "actualSendPerformed", false),
    `release=${statusOf(releaseReadiness)}; board=${statusOf(blockerBoard)}; brief=${statusOf(operatorBrief)}; summary=${statusOf(
      statusSummary
    )}; takeover=${statusOf(takeoverMatrix)}; launch=${statusOf(launchChecklist)}; finalGoNoGo=${statusOf(
      firstRealTesterFinalGoNoGo
    )}; actualSend=${String(firstRealTesterFinalGoNoGo?.actualSendPerformed ?? "missing")}`
  );

  const passed = checks.filter((check) => check.pass).length;
  const receipt = {
    responseMode: "productization_evidence_freshness_json_v1",
    status: passed === checks.length ? "passed" : "failed",
    generatedAt: new Date().toISOString(),
    command: "npm run verify:productization-evidence-freshness",
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
      passed === checks.length
        ? "Keep this receipt with the source package so maintainers can see the productization evidence, including the takeover matrix, controlled launch checklist, and first-real tester send/return handoff chain, is from one coherent refresh sequence."
        : "Refresh the failed artifact sequence, then rerun npm run verify:productization-evidence-freshness."
  };

  fs.mkdirSync(artifactsDir, { recursive: true });
  fs.writeFileSync(receiptPath, JSON.stringify(receipt, null, 2));
  console.log(JSON.stringify(receipt, null, 2));
  console.log(`\nProductization evidence freshness receipt written to ${receiptPath}`);

  if (receipt.status !== "passed") {
    process.exitCode = 1;
  }
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
