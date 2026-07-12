import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { visualLearningAcceptanceGate } from "../src/lib/teacher-acceptance";
import { getAIServiceRuntimeStatus } from "../src/server/ai/service";
import {
  isPublicBetaFreshnessOnlyPending,
  isPublicBetaGateReady
} from "../src/server/productization/public-beta-recovery";

const artifactsDir = path.join(process.cwd(), "artifacts", "productization");
const summaryJsonPath = path.join(artifactsDir, "product-status-summary.json");
const summaryMarkdownPath = path.join(artifactsDir, "product-status-summary.md");
const testerRunbookPath = "artifacts/productization/public-beta-packet/docs/PUBLIC_BETA_TESTER_RUNBOOK.md";
const sessionPlanPath = "artifacts/productization/public-beta-packet/docs/PUBLIC_BETA_SESSION_PLAN.md";
const sessionReceiptTemplatePath = "artifacts/productization/public-beta-packet/docs/PUBLIC_BETA_SESSION_RECEIPT.template.json";
const betaPacketOverviewPath = "artifacts/productization/public-beta-packet/START_PUBLIC_BETA.md";

function readJson<T>(relativePath: string): T | null {
  try {
    return JSON.parse(fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")) as T;
  } catch {
    return null;
  }
}

function markdownEscape(value: string) {
  return value.replaceAll("|", "\\|");
}

function statusLine(status: string | undefined, passed?: number, total?: number) {
  if (typeof passed === "number" && typeof total === "number") return `${status ?? "missing"} ${passed}/${total}`;
  return status ?? "missing";
}

export function buildProductStatusSummary() {
  const publicBeta = readJson<{
    status?: string;
    betaCanStart?: boolean;
    requiredPassed?: number;
    requiredTotal?: number;
    passed?: number;
    total?: number;
    releaseDecision?: string;
    checks?: Array<{ name?: string; pass?: boolean; evidence?: string }>;
  }>("artifacts/productization/public-beta-readiness.json");
  const publicBetaManifest = readJson<{
    entrypoints?: {
      startHere?: string;
      testerRunbook?: string;
      publicBetaSessionPlan?: string;
      publicBetaSessionReceiptTemplate?: string;
    };
    generatedFiles?: Array<{ destination?: string; role?: string; required?: boolean; bytes?: number }>;
  }>("artifacts/productization/public-beta-packet/public-beta-manifest.json");
  const sessionPlan = readJson<{
    status?: string;
    canStartSession?: boolean;
    failedReasons?: string[];
    sessionTimeboxMinutes?: number;
    sessionPhases?: unknown[];
    launchPreflight?: { command?: string; evidencePath?: string };
  }>("artifacts/productization/public-beta-session-plan.json");
  const sessionPlanVerification = readJson<{
    status?: string;
    passed?: number;
    total?: number;
  }>("artifacts/productization/public-beta-session-plan-verification.json");
  const sessionReceiptValidation = readJson<{
    status?: string;
    mode?: string;
    passed?: number;
    total?: number;
    releaseDecision?: string;
    reviewOnly?: boolean;
    accepted?: boolean;
    packagingGated?: boolean;
    canRelease?: boolean;
  }>("artifacts/productization/public-beta-session-receipt-validation.json");
  const releaseReadiness = readJson<{
    responseMode?: string;
    status?: string;
    releaseDecision?: string;
    blockers?: Array<{ name?: string; evidence?: string; nextAction?: string }>;
    boundary?: { accepted?: boolean; packagingGated?: boolean; activeProvider?: string };
  }>("artifacts/productization/product-release-readiness.json");
  const operatorBrief = readJson<{
    status?: string;
    releaseDecision?: string;
    canInviteBoundedBetaTester?: boolean;
    canStartHumanAcceptanceReview?: boolean;
    canPlanRealModelTrial?: boolean;
    canRelease?: boolean;
    failedReasons?: string[];
  }>("artifacts/productization/product-operator-brief.json");
  const operatorBriefVerification = readJson<{ status?: string; passed?: number; total?: number }>(
    "artifacts/productization/product-operator-brief-verification.json"
  );
  const blockerBoard = readJson<{
    status?: string;
    releaseDecision?: string;
    accepted?: boolean;
    packagingGated?: boolean;
    canRelease?: boolean;
    failedReasons?: string[];
    lanes?: Array<{ id?: string; title?: string; status?: string; currentEvidence?: string; nextAction?: string }>;
  }>("artifacts/productization/product-release-blocker-board.json");
  const blockerBoardVerification = readJson<{ status?: string; passed?: number; total?: number }>(
    "artifacts/productization/product-release-blocker-board-verification.json"
  );
  const handoff = readJson<{ status?: string; passed?: number; total?: number }>(
    "artifacts/productization/product-handoff-readiness.json"
  );
  const humanGate = readJson<{
    status?: string;
    latestEvidenceKind?: string;
    latestHumanReviewed?: boolean;
    latestAutomationGenerated?: boolean;
  }>("artifacts/productization/human-acceptance-gate.json");
  const reviewerInvite = readJson<{
    status?: string;
    canInviteHumanReviewer?: boolean;
    failedReasons?: string[];
  }>("artifacts/productization/human-acceptance-reviewer-invite.json");
  const reviewerInviteVerification = readJson<{ status?: string; passed?: number; total?: number }>(
    "artifacts/productization/human-acceptance-reviewer-invite-verification.json"
  );
  const realModelContract = readJson<{
    status?: string;
    passed?: number;
    total?: number;
    realNetworkUsed?: boolean;
    realProviderAccepted?: boolean;
    canActivateRealModel?: boolean;
    canRelease?: boolean;
  }>("artifacts/productization/real-model-adapter-contract-verification.json");
  const realModelKit = readJson<{
    status?: string;
    canActivateRealModel?: boolean;
    canRelease?: boolean;
    aiService?: { activeProvider?: string; realModelReady?: boolean };
  }>("artifacts/productization/real-model-trial-kit.json");
  const releaseApprovalReturn = readJson<{ status?: string; passed?: number; total?: number }>(
    "artifacts/productization/product-release-approval-return-intake-verification.json"
  );
  const realModelReturn = readJson<{ status?: string; passed?: number; total?: number }>(
    "artifacts/productization/real-model-trial-return-intake-verification.json"
  );
  const feedbackCollection = readJson<{
    status?: string;
    totalReceipts?: number;
    validReceipts?: number;
    invalidReceipts?: number;
    releaseDecision?: string;
    reviewOnly?: boolean;
    accepted?: boolean;
    packagingGated?: boolean;
  }>("artifacts/productization/public-beta-feedback-collection.json");
  const feedbackCollectionVerification = readJson<{
    status?: string;
    passed?: number;
    total?: number;
    releaseDecision?: string;
    accepted?: boolean;
    packagingGated?: boolean;
  }>("artifacts/productization/public-beta-feedback-collection-verification.json");
  const followUpPlan = readJson<{
    status?: string;
    canInviteNextTester?: boolean;
    releaseDecision?: string;
    reviewOnly?: boolean;
    accepted?: boolean;
    packagingGated?: boolean;
    actions?: unknown[];
  }>("artifacts/productization/public-beta-follow-up-plan.json");
  const followUpPlanVerification = readJson<{
    status?: string;
    passed?: number;
    total?: number;
    releaseDecision?: string;
    accepted?: boolean;
    packagingGated?: boolean;
  }>("artifacts/productization/public-beta-follow-up-plan-verification.json");
  const ai = getAIServiceRuntimeStatus();

  const testerRunbookReady =
    publicBetaManifest?.entrypoints?.startHere === betaPacketOverviewPath &&
    publicBetaManifest.entrypoints.testerRunbook === testerRunbookPath &&
    publicBetaManifest.generatedFiles?.some(
      (file) =>
        file.destination === "docs/PUBLIC_BETA_TESTER_RUNBOOK.md" &&
        file.role === "tester_runbook" &&
        file.required === true &&
        Number(file.bytes ?? 0) >= 1000
    ) === true &&
    fs.existsSync(path.join(process.cwd(), testerRunbookPath)) &&
    fs.statSync(path.join(process.cwd(), testerRunbookPath)).size >= 1000;
  const testerSessionPlanReady =
    sessionPlan?.status === "ready_for_session" &&
    sessionPlan.canStartSession === true &&
    (sessionPlan.failedReasons?.length ?? 0) === 0 &&
    sessionPlan.launchPreflight?.command === "npm run preflight:public-beta-tester -- --base-url http://127.0.0.1:3000" &&
    Number(sessionPlan.sessionTimeboxMinutes ?? 0) >= 30 &&
    Number(sessionPlan.sessionPhases?.length ?? 0) >= 4 &&
    sessionPlanVerification?.status === "passed" &&
    sessionPlanVerification.passed === sessionPlanVerification.total &&
    publicBetaManifest?.entrypoints?.publicBetaSessionPlan === sessionPlanPath &&
    fs.existsSync(path.join(process.cwd(), sessionPlanPath)) &&
    fs.statSync(path.join(process.cwd(), sessionPlanPath)).size >= 1000;
  const testerSessionReceiptReady =
    sessionReceiptValidation?.status === "template_ready" &&
    sessionReceiptValidation.mode === "template" &&
    sessionReceiptValidation.passed === sessionReceiptValidation.total &&
    Number(sessionReceiptValidation.total ?? 0) >= 9 &&
    sessionReceiptValidation.releaseDecision === "do_not_release" &&
    sessionReceiptValidation.reviewOnly === true &&
    sessionReceiptValidation.accepted === false &&
    sessionReceiptValidation.packagingGated === true &&
    sessionReceiptValidation.canRelease === false &&
    publicBetaManifest?.entrypoints?.publicBetaSessionReceiptTemplate === sessionReceiptTemplatePath &&
    fs.existsSync(path.join(process.cwd(), sessionReceiptTemplatePath)) &&
    fs.statSync(path.join(process.cwd(), sessionReceiptTemplatePath)).size >= 1000;
  const publicBetaFreshnessOnlyPending = isPublicBetaFreshnessOnlyPending(publicBeta);
  const publicBetaGateReadyForSummary = isPublicBetaGateReady(publicBeta);
  const betaReady =
    publicBetaGateReadyForSummary &&
    testerRunbookReady &&
    testerSessionPlanReady &&
    testerSessionReceiptReady;
  const releaseBlocked =
    releaseReadiness?.status === "blocked_not_release_ready" &&
    releaseReadiness.releaseDecision === "do_not_release" &&
    releaseReadiness.boundary?.accepted === false &&
    releaseReadiness.boundary?.packagingGated === true;
  const handoffReady = handoff?.status === "passed" && handoff.passed === handoff.total;
  const briefReady =
    operatorBrief?.status === "ready_for_operator_handoff" &&
    operatorBrief.releaseDecision === "do_not_release" &&
    operatorBrief.canRelease === false &&
    (operatorBrief.failedReasons?.length ?? -1) === 0 &&
    operatorBriefVerification?.status === "passed";
  const blockerBoardReady =
    blockerBoard?.status === "ready_for_blocker_resolution" &&
    blockerBoard.releaseDecision === "do_not_release" &&
    blockerBoard.accepted === false &&
    blockerBoard.packagingGated === true &&
    blockerBoard.canRelease === false &&
    (blockerBoard.failedReasons?.length ?? -1) === 0 &&
    Number(blockerBoard.lanes?.length ?? 0) === 3 &&
    blockerBoardVerification?.status === "passed";
  const betaFeedbackLoopReady =
    feedbackCollection?.releaseDecision === "do_not_release" &&
    feedbackCollection.reviewOnly === true &&
    feedbackCollection.accepted === false &&
    feedbackCollection.packagingGated === true &&
    feedbackCollectionVerification?.status === "passed" &&
    feedbackCollectionVerification.passed === feedbackCollectionVerification.total &&
    followUpPlan?.releaseDecision === "do_not_release" &&
    followUpPlan.reviewOnly === true &&
    followUpPlan.accepted === false &&
    followUpPlan.packagingGated === true &&
    Number(followUpPlan.actions?.length ?? 0) >= 1 &&
    followUpPlanVerification?.status === "passed" &&
    followUpPlanVerification.passed === followUpPlanVerification.total;
  const reviewerInviteReady =
    reviewerInvite?.status === "ready_to_invite_reviewer" &&
    reviewerInvite.canInviteHumanReviewer === true &&
    (reviewerInvite.failedReasons?.length ?? 0) === 0 &&
    reviewerInviteVerification?.status === "passed" &&
    reviewerInviteVerification.passed === reviewerInviteVerification.total;
  const realModelLocked =
    ai.activeProvider === "mock" &&
    ai.realModelReady === false &&
    realModelContract?.status === "passed" &&
    realModelContract.realNetworkUsed === false &&
    realModelContract.realProviderAccepted === false &&
    realModelContract.canActivateRealModel === false &&
    realModelKit?.status === "ready_for_real_model_trial_planning" &&
    realModelKit.canActivateRealModel === false;
  const hardLocksPreserved =
    visualLearningAcceptanceGate.accepted === false &&
    visualLearningAcceptanceGate.packagingGated === true &&
    releaseBlocked &&
    realModelLocked;

  const failedReasons: string[] = [];
  if (!betaReady) failedReasons.push("public_beta_not_ready");
  if (!testerRunbookReady) failedReasons.push("tester_runbook_not_ready");
  if (!testerSessionPlanReady) failedReasons.push("tester_session_plan_not_ready");
  if (!testerSessionReceiptReady) failedReasons.push("tester_session_receipt_template_not_ready");
  if (!releaseBlocked) failedReasons.push("release_not_blocked_as_expected");
  if (!handoffReady) failedReasons.push("handoff_not_verified");
  if (!briefReady) failedReasons.push("operator_brief_not_ready");
  if (!blockerBoardReady) failedReasons.push("blocker_board_not_ready");
  if (!betaFeedbackLoopReady) failedReasons.push("public_beta_feedback_loop_not_ready");
  if (!reviewerInviteReady) failedReasons.push("human_acceptance_reviewer_invite_not_ready");
  if (!realModelLocked) failedReasons.push("real_model_boundary_not_locked");
  if (!hardLocksPreserved) failedReasons.push("hard_locks_not_preserved");

  const releaseBlockers = (releaseReadiness?.blockers ?? []).map((blocker) => ({
    name: blocker.name ?? "unnamed_blocker",
    evidence: blocker.evidence ?? "missing",
    nextAction: blocker.nextAction ?? "missing"
  }));

  const nextBestActions = [
    {
      id: "invite_one_bounded_beta_tester",
      allowed: betaReady && operatorBrief?.canInviteBoundedBetaTester === true,
      command: "npm run preflight:public-beta-tester -- --base-url http://127.0.0.1:3000",
      evidencePath: betaPacketOverviewPath,
      testerRunbookPath,
      sessionPlanPath,
      sessionReceiptTemplatePath,
      stopCondition:
        "Stop if preflight fails, betaCanStart is false, tester materials are missing, the session receipt template is unavailable, or releaseDecision is not do_not_release."
    },
    {
      id: "collect_real_human_acceptance",
      allowed: operatorBrief?.canStartHumanAcceptanceReview === true,
      command: "npm run preflight:human-acceptance -- --base-url http://127.0.0.1:3000",
      evidencePath: "artifacts/productization/human-acceptance-reviewer-invite.md",
      reviewerKitPath: "artifacts/productization/human-acceptance-reviewer-kit.md",
      stopCondition:
        "Stop if the invite is stale, preflight fails, reviewer kit is missing, evidence remains automated_browser_smoke, or the reviewer cannot attest the core loop."
    },
    {
      id: "process_public_beta_feedback_return",
      allowed: betaFeedbackLoopReady,
      command: "npm run intake:public-beta-return -- --receipt path/to/submitted-feedback.json --session-receipt path/to/filled-public-beta-session-receipt.json --send-receipt-validation artifacts/productization/first-real-tester-send-receipt-validation.json",
      evidencePath: "artifacts/productization/public-beta-follow-up-plan.json",
      stopCondition:
        "Stop if either receipt is invalid, tester.name/tester.date do not match, sessionEvidence.feedbackReceiptPath does not point at the submitted feedback receipt, feedback is blocked, requests fixes before more testers, or implies release/all-software acceptance."
    },
    {
      id: "plan_real_model_trial_without_activation",
      allowed: operatorBrief?.canPlanRealModelTrial === true && realModelLocked,
      command: "npm run verify:real-model-adapter-contract",
      evidencePath: "artifacts/productization/real-model-trial-kit.md",
      stopCondition:
        "Stop if credentials would enter source control, realNetworkUsed appears in adapter evidence, model acceptance is missing, rollback_to_mock_after_trial is not confirmed, or canActivateRealModel becomes true."
    }
  ];

  const summary = {
    responseMode: "product_status_summary_json_v1",
    status: failedReasons.length === 0 ? "ready_for_bounded_beta_not_release" : "needs_productization_work",
    generatedAt: new Date().toISOString(),
    command: "npm run build:product-status-summary",
    productScope: "bounded_core_teaching_loop",
    allSoftwareObjective: "paused",
    releaseDecision: "do_not_release",
    betaCanStart: betaReady,
    canRelease: false,
    canActivateRealModel: false,
    reviewOnly: true,
    accepted: false,
    packagingGated: true,
    hardLocksPreserved,
    readiness: {
      handoff: statusLine(handoff?.status, handoff?.passed, handoff?.total),
      publicBeta: `${publicBetaGateReadyForSummary ? "passed" : publicBeta?.status ?? "missing"}; betaCanStart=${
        publicBetaGateReadyForSummary
      }; required=${publicBeta?.requiredPassed ?? publicBeta?.passed ?? 0}/${
        publicBeta?.requiredTotal ?? publicBeta?.total ?? 0
      }${publicBetaFreshnessOnlyPending ? "; recovery=pending_productization_evidence_freshness_refresh" : ""}`,
      testerRunbook: `ready=${testerRunbookReady}; path=${testerRunbookPath}`,
      publicBetaSessionPlan: `ready=${testerSessionPlanReady}; path=${sessionPlanPath}; verifier=${statusLine(
        sessionPlanVerification?.status,
        sessionPlanVerification?.passed,
        sessionPlanVerification?.total
      )}`,
      publicBetaSessionReceipt: `ready=${testerSessionReceiptReady}; path=${sessionReceiptTemplatePath}; verifier=${statusLine(
        sessionReceiptValidation?.status,
        sessionReceiptValidation?.passed,
        sessionReceiptValidation?.total
      )}; mode=${sessionReceiptValidation?.mode ?? "missing"}`,
      operatorBrief: statusLine(operatorBrief?.status, operatorBriefVerification?.passed, operatorBriefVerification?.total),
      releaseBlockerBoard: statusLine(blockerBoard?.status, blockerBoardVerification?.passed, blockerBoardVerification?.total),
      publicBetaFeedbackCollection: `${feedbackCollection?.status ?? "missing"}; total=${
        feedbackCollection?.totalReceipts ?? 0
      }; valid=${feedbackCollection?.validReceipts ?? 0}; invalid=${feedbackCollection?.invalidReceipts ?? 0}; verifier=${statusLine(
        feedbackCollectionVerification?.status,
        feedbackCollectionVerification?.passed,
        feedbackCollectionVerification?.total
      )}`,
      publicBetaFollowUpPlan: `${followUpPlan?.status ?? "missing"}; canInviteNextTester=${
        followUpPlan?.canInviteNextTester ?? false
      }; actions=${followUpPlan?.actions?.length ?? 0}; verifier=${statusLine(
        followUpPlanVerification?.status,
        followUpPlanVerification?.passed,
        followUpPlanVerification?.total
      )}`,
      release: `${releaseReadiness?.status ?? "missing"}; blockers=${releaseBlockers.length}; decision=${
        releaseReadiness?.releaseDecision ?? "missing"
      }`,
      humanAcceptance: `gate=${humanGate?.status ?? "missing"}; evidence=${
        humanGate?.latestEvidenceKind ?? "missing"
      }; humanReviewed=${humanGate?.latestHumanReviewed ?? false}`,
      humanAcceptanceReviewerInvite: `${reviewerInvite?.status ?? "missing"}; canInvite=${
        reviewerInvite?.canInviteHumanReviewer ?? false
      }; verifier=${statusLine(reviewerInviteVerification?.status, reviewerInviteVerification?.passed, reviewerInviteVerification?.total)}`,
      realModel: `activeProvider=${ai.activeProvider}; realModelReady=${ai.realModelReady}; contract=${
        realModelContract?.status ?? "missing"
      }; trialKit=${realModelKit?.status ?? "missing"}`,
      releaseApprovalReturnIntake: statusLine(releaseApprovalReturn?.status, releaseApprovalReturn?.passed, releaseApprovalReturn?.total),
      realModelReturnIntake: statusLine(realModelReturn?.status, realModelReturn?.passed, realModelReturn?.total)
    },
    sourceEvidence: {
      publicBetaReadiness: "artifacts/productization/public-beta-readiness.json",
      publicBetaPacketOverview: betaPacketOverviewPath,
      publicBetaTesterRunbook: testerRunbookPath,
      publicBetaSessionPlan: sessionPlanPath,
      publicBetaSessionPlanVerification: "artifacts/productization/public-beta-session-plan-verification.json",
      publicBetaSessionReceiptTemplate: sessionReceiptTemplatePath,
      publicBetaSessionReceiptValidation: "artifacts/productization/public-beta-session-receipt-validation.json",
      productReleaseReadiness: "artifacts/productization/product-release-readiness.json",
      productOperatorBrief: "artifacts/productization/product-operator-brief.json",
      productOperatorBriefVerification: "artifacts/productization/product-operator-brief-verification.json",
      productReleaseBlockerBoard: "artifacts/productization/product-release-blocker-board.json",
      productReleaseBlockerBoardVerification: "artifacts/productization/product-release-blocker-board-verification.json",
      publicBetaFeedbackCollection: "artifacts/productization/public-beta-feedback-collection.json",
      publicBetaFeedbackCollectionVerification:
        "artifacts/productization/public-beta-feedback-collection-verification.json",
      publicBetaFollowUpPlan: "artifacts/productization/public-beta-follow-up-plan.json",
      publicBetaFollowUpPlanVerification: "artifacts/productization/public-beta-follow-up-plan-verification.json",
      productHandoffReadiness: "artifacts/productization/product-handoff-readiness.json",
      humanAcceptanceGate: "artifacts/productization/human-acceptance-gate.json",
      humanAcceptanceReviewerInvite: "artifacts/productization/human-acceptance-reviewer-invite.json",
      humanAcceptanceReviewerInviteVerification: "artifacts/productization/human-acceptance-reviewer-invite-verification.json",
      humanAcceptanceReviewerInviteMarkdown: "artifacts/productization/human-acceptance-reviewer-invite.md",
      realModelAdapterContract: "artifacts/productization/real-model-adapter-contract-verification.json",
      realModelTrialKit: "artifacts/productization/real-model-trial-kit.json"
    },
    releaseBlockers,
    nextBestActions,
    blockedActions: [
      "release_product",
      "unlock_packaging",
      "activate_real_model",
      "resume_all_software_scope",
      "claim_real_human_acceptance_from_automation"
    ],
    failedReasons,
    nextAction:
      failedReasons.length === 0
        ? "Use this as the one-page product status companion after the takeover matrix: start one bounded beta, process returned feedback through the follow-up plan, collect real human acceptance, and plan real-model trial while release stays blocked."
        : "Fix failed status-summary reasons, then rebuild and verify this summary."
  };

  const markdown = `# Product Status Summary

Status: \`${summary.status}\`

Scope: \`${summary.productScope}\`

Release decision: \`${summary.releaseDecision}\`

## Status At A Glance

| Question | Answer |
| --- | --- |
| Can one bounded beta start? | \`${summary.betaCanStart}\` |
| Can this be released? | \`${summary.canRelease}\` |
| Can a real model be activated? | \`${summary.canActivateRealModel}\` |
| Is all-software scope active? | \`${summary.allSoftwareObjective}\` |
| Are hard locks preserved? | \`${summary.hardLocksPreserved}\` |

## Next Best Actions

| Action | Allowed | Command | Evidence | Tester runbook | Session plan | Session receipt | Stop condition |
| --- | --- | --- | --- | --- | --- | --- | --- |
${nextBestActions
  .map((action) => {
    const runbook = "testerRunbookPath" in action && typeof action.testerRunbookPath === "string" ? action.testerRunbookPath : "";
    const sessionPlan = "sessionPlanPath" in action && typeof action.sessionPlanPath === "string" ? action.sessionPlanPath : "";
    const sessionReceipt =
      "sessionReceiptTemplatePath" in action && typeof action.sessionReceiptTemplatePath === "string"
        ? action.sessionReceiptTemplatePath
        : "";
    const stopCondition = "stopCondition" in action && typeof action.stopCondition === "string" ? action.stopCondition : "";
    return `| ${markdownEscape(action.id)} | \`${action.allowed}\` | \`${markdownEscape(action.command)}\` | \`${markdownEscape(
      action.evidencePath
    )}\` | \`${markdownEscape(runbook)}\` | \`${markdownEscape(sessionPlan)}\` | \`${markdownEscape(sessionReceipt)}\` | ${markdownEscape(stopCondition)} |`;
  })
  .join("\n")}

## Release Blockers

| Blocker | Evidence | Next action |
| --- | --- | --- |
${releaseBlockers
  .map(
    (blocker) =>
      `| ${markdownEscape(blocker.name)} | ${markdownEscape(blocker.evidence)} | ${markdownEscape(blocker.nextAction)} |`
  )
  .join("\n")}

## Evidence Snapshot

| Area | Status |
| --- | --- |
${Object.entries(summary.readiness)
  .map(([area, value]) => `| ${markdownEscape(area)} | \`${markdownEscape(String(value))}\` |`)
  .join("\n")}

## Blocked Actions

${summary.blockedActions.map((action) => `- \`${action}\``).join("\n")}

## Boundary

This summary is review-only. It keeps \`accepted=false\`, \`packagingGated=true\`, \`canRelease=false\`, \`canActivateRealModel=false\`, and \`allSoftwareObjective=paused\`.

## Failed Reasons

${failedReasons.length === 0 ? "- none" : failedReasons.map((reason) => `- ${reason}`).join("\n")}
`;

  fs.mkdirSync(artifactsDir, { recursive: true });
  fs.writeFileSync(summaryJsonPath, JSON.stringify(summary, null, 2));
  fs.writeFileSync(summaryMarkdownPath, markdown);
  return summary;
}

function main() {
  const summary = buildProductStatusSummary();
  console.log(JSON.stringify(summary, null, 2));
  console.log(`\nProduct status summary written to ${summaryJsonPath}`);
  console.log(`Product status summary Markdown written to ${summaryMarkdownPath}`);

  if (summary.status !== "ready_for_bounded_beta_not_release") {
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



