import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { visualLearningAcceptanceGate } from "../src/lib/teacher-acceptance";
import { getAIServiceRuntimeStatus } from "../src/server/ai/service";

const artifactsDir = path.join(process.cwd(), "artifacts", "productization");
const briefJsonPath = path.join(artifactsDir, "product-operator-brief.json");
const briefMarkdownPath = path.join(artifactsDir, "product-operator-brief.md");
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

export function buildProductOperatorBrief() {
  const health = readJson<{ status?: string; passed?: number; total?: number }>(
    "artifacts/productization/product-runtime-doctor.json"
  );
  const smoke = readJson<{ status?: string; passed?: number; total?: number }>(
    "artifacts/productization/product-ui-api-smoke.json"
  );
  const handoff = readJson<{ status?: string; passed?: number; total?: number }>(
    "artifacts/productization/product-handoff-readiness.json"
  );
  const publicBeta = readJson<{
    status?: string;
    betaCanStart?: boolean;
    releaseDecision?: string;
    passed?: number;
    total?: number;
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
  const publicBetaPreparation = readJson<{
    status?: string;
    releaseDecision?: string;
    accepted?: boolean;
    packagingGated?: boolean;
    passed?: number;
    total?: number;
  }>("artifacts/productization/public-beta-preparation.json");
  const testerInvite = readJson<{ status?: string; canInvite?: boolean; failedReasons?: string[] }>(
    "artifacts/productization/public-beta-tester-invite.json"
  );
  const testerPreflight = readJson<{
    status?: string;
    canInviteTester?: boolean;
    passed?: number;
    total?: number;
    accepted?: boolean;
    packagingGated?: boolean;
  }>("artifacts/productization/public-beta-tester-session-preflight.json");
  const humanPreflight = readJson<{
    status?: string;
    canStartHumanAcceptance?: boolean;
    passed?: number;
    total?: number;
    accepted?: boolean;
    packagingGated?: boolean;
  }>("artifacts/productization/human-acceptance-session-preflight.json");
  const reviewerKit = readJson<{
    status?: string;
    canStartReviewerSession?: boolean;
    failedReasons?: string[];
    reviewerSteps?: unknown[];
  }>("artifacts/productization/human-acceptance-reviewer-kit.json");
  const reviewerInvite = readJson<{
    status?: string;
    canInviteHumanReviewer?: boolean;
    failedReasons?: string[];
    reviewerEntrypoints?: { reviewerKit?: string; receiptTemplate?: string; manualTest?: string };
  }>("artifacts/productization/human-acceptance-reviewer-invite.json");
  const reviewerInviteVerification = readJson<{
    status?: string;
    passed?: number;
    total?: number;
  }>("artifacts/productization/human-acceptance-reviewer-invite-verification.json");
  const humanGate = readJson<{
    status?: string;
    latestEvidenceKind?: string;
    latestHumanReviewed?: boolean;
    latestAutomationGenerated?: boolean;
  }>("artifacts/productization/human-acceptance-gate.json");
  const releaseReadiness = readJson<{
    status?: string;
    releaseDecision?: string;
    blockers?: Array<{ name?: string; evidence?: string; nextAction?: string }>;
    boundary?: { accepted?: boolean; packagingGated?: boolean; activeProvider?: string };
  }>("artifacts/productization/product-release-readiness.json");
  const adapterContract = readJson<{
    responseMode?: string;
    status?: string;
    releaseDecision?: string;
    accepted?: boolean;
    packagingGated?: boolean;
    realNetworkUsed?: boolean;
    realProviderAccepted?: boolean;
    canActivateRealModel?: boolean;
    canRelease?: boolean;
    passed?: number;
    total?: number;
  }>("artifacts/productization/real-model-adapter-contract-verification.json");
  const realModelKit = readJson<{
    status?: string;
    canActivateRealModel?: boolean;
    canRelease?: boolean;
    failedReasons?: string[];
    aiService?: { activeProvider?: string; realModelReady?: boolean };
  }>("artifacts/productization/real-model-trial-kit.json");
  const releaseApprovalValidation = readJson<{
    status?: string;
    mode?: string;
    canRelease?: boolean;
    accepted?: boolean;
    packagingGated?: boolean;
    passed?: number;
    total?: number;
  }>("artifacts/productization/product-release-approval-validation.json");
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

  const canInviteBoundedBetaTester =
    testerRunbookReady &&
    testerSessionPlanReady &&
    testerSessionReceiptReady &&
    publicBeta?.status === "passed" &&
    publicBeta.betaCanStart === true &&
    publicBeta.releaseDecision === "do_not_release" &&
    publicBetaPreparation?.status === "passed" &&
    publicBetaPreparation.accepted === false &&
    publicBetaPreparation.packagingGated === true;

  const canStartHumanAcceptanceReview =
    humanPreflight?.status === "passed" &&
    humanPreflight.canStartHumanAcceptance === true &&
    humanPreflight.accepted === false &&
    humanPreflight.packagingGated === true &&
    reviewerKit?.status === "ready_for_reviewer" &&
    reviewerKit.canStartReviewerSession === true &&
    (reviewerKit.failedReasons?.length ?? 0) === 0 &&
    reviewerInvite?.status === "ready_to_invite_reviewer" &&
    reviewerInvite.canInviteHumanReviewer === true &&
    (reviewerInvite.failedReasons?.length ?? 0) === 0 &&
    reviewerInviteVerification?.status === "passed" &&
    reviewerInviteVerification.passed === reviewerInviteVerification.total;

  const canPlanRealModelTrial =
    adapterContract?.status === "passed" &&
    adapterContract.passed === adapterContract.total &&
    adapterContract.realNetworkUsed === false &&
    adapterContract.realProviderAccepted === false &&
    adapterContract.canActivateRealModel === false &&
    realModelKit?.status === "ready_for_real_model_trial_planning" &&
    realModelKit.canActivateRealModel === false &&
    (realModelKit.failedReasons?.length ?? 0) === 0;

  const canProcessBetaFeedbackLoop =
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

  const releaseLocked =
    releaseReadiness?.status === "blocked_not_release_ready" &&
    releaseReadiness.releaseDecision === "do_not_release" &&
    releaseReadiness.boundary?.accepted === false &&
    releaseReadiness.boundary?.packagingGated === true &&
    visualLearningAcceptanceGate.accepted === false &&
    visualLearningAcceptanceGate.packagingGated === true &&
    releaseApprovalValidation?.status === "template_ready" &&
    releaseApprovalValidation.canRelease === false;

  const failedReasons: string[] = [];
  if (health?.status !== "passed") failedReasons.push("product_doctor_not_passed");
  if (smoke?.status !== "passed") failedReasons.push("product_smoke_not_passed");
  if (!canInviteBoundedBetaTester) failedReasons.push("bounded_beta_not_ready_to_invite");
  if (!testerRunbookReady) failedReasons.push("tester_runbook_not_ready");
  if (!testerSessionPlanReady) failedReasons.push("tester_session_plan_not_ready");
  if (!testerSessionReceiptReady) failedReasons.push("tester_session_receipt_template_not_ready");
  if (!canStartHumanAcceptanceReview) failedReasons.push("human_acceptance_review_not_ready");
  if (!canProcessBetaFeedbackLoop) failedReasons.push("public_beta_feedback_loop_not_ready");
  if (!canPlanRealModelTrial) failedReasons.push("real_model_trial_planning_not_ready");
  if (!releaseLocked) failedReasons.push("release_lock_not_preserved");
  if (ai.activeProvider !== "mock" || ai.realModelReady !== false) failedReasons.push("ai_provider_boundary_not_mock");

  const immediateActions = [
    {
      id: "invite_one_bounded_beta_tester",
      title: "Invite one bounded beta tester",
      allowed: canInviteBoundedBetaTester,
      command: "npm run preflight:public-beta-tester -- --base-url http://127.0.0.1:3000",
      evidencePath: betaPacketOverviewPath,
      testerRunbookPath,
      sessionPlanPath,
      sessionReceiptTemplatePath,
      stopCondition:
        "Stop if preflight fails, if betaCanStart is false, if tester runbook, session plan, or session receipt template is missing, or if releaseDecision is not do_not_release."
    },
    {
      id: "run_real_human_acceptance_review",
      title: "Run real human acceptance review",
      allowed: canStartHumanAcceptanceReview,
      command: "npm run preflight:human-acceptance -- --base-url http://127.0.0.1:3000",
      evidencePath: "artifacts/productization/human-acceptance-reviewer-invite.md",
      reviewerKitPath: "artifacts/productization/human-acceptance-reviewer-kit.md",
      stopCondition: "Stop if the invite is stale, the preflight fails, the evidence is automated_browser_smoke, or the reviewer cannot attest the core loop."
    },
    {
      id: "process_returned_public_beta_feedback",
      title: "Process returned public beta feedback",
      allowed: canProcessBetaFeedbackLoop,
      command: "npm run intake:public-beta-return -- --receipt path/to/submitted-feedback.json --session-receipt path/to/filled-public-beta-session-receipt.json --send-receipt-validation artifacts/productization/first-real-tester-send-receipt-validation.json",
      evidencePath: "artifacts/productization/public-beta-follow-up-plan.json",
      stopCondition:
        "Stop if either receipt is invalid, tester.name/tester.date do not match, sessionEvidence.feedbackReceiptPath does not point at the submitted feedback receipt, feedback is blocked, requests fixes before more testers, or implies release/all-software acceptance."
    },
    {
      id: "plan_separate_real_model_trial",
      title: "Plan a separate real-model trial",
      allowed: canPlanRealModelTrial,
      command: "npm run verify:real-model-adapter-contract",
      evidencePath: "artifacts/productization/real-model-trial-kit.md",
      stopCondition: "Stop if credentials would enter source control, realNetworkUsed appears in the contract verifier, or model acceptance is missing."
    }
  ];

  const blockedActions = [
    {
      id: "release_product",
      title: "Release product",
      blocked: true,
      reason: "Release readiness is blocked until real human acceptance, real-model acceptance, and separate release approval exist."
    },
    {
      id: "unlock_packaging",
      title: "Unlock packaging",
      blocked: true,
      reason: "Packaging remains gated until explicit release approval; this brief cannot unlock it."
    },
    {
      id: "resume_all_software_scope",
      title: "Resume all-software objective",
      blocked: true,
      reason: "Current product scope is the bounded core teaching loop; all-software remains paused."
    },
    {
      id: "activate_real_model_from_fake_fetch",
      title: "Activate real model from fake-fetch evidence",
      blocked: true,
      reason: "Adapter contract evidence is fake-fetch only and cannot accept or activate a real provider."
    }
  ];

  const brief = {
    responseMode: "product_operator_brief_json_v1",
    status: failedReasons.length === 0 ? "ready_for_operator_handoff" : "needs_productization_work",
    generatedAt: new Date().toISOString(),
    command: "npm run build:product-operator-brief",
    productScope: "bounded_core_teaching_loop",
    allSoftwareObjective: "paused",
    releaseDecision: "do_not_release",
    reviewOnly: true,
    accepted: false,
    packagingGated: true,
    canRelease: false,
    canInviteBoundedBetaTester,
    canStartHumanAcceptanceReview,
    canProcessBetaFeedbackLoop,
    canPlanRealModelTrial,
    canActivateRealModel: false,
    failedReasons,
    sourceEvidence: {
      health: { status: health?.status ?? "missing", passed: health?.passed ?? 0, total: health?.total ?? 0 },
      smoke: { status: smoke?.status ?? "missing", passed: smoke?.passed ?? 0, total: smoke?.total ?? 0 },
      handoff: { status: handoff?.status ?? "missing", passed: handoff?.passed ?? 0, total: handoff?.total ?? 0 },
      publicBeta: {
        status: publicBeta?.status ?? "missing",
        betaCanStart: publicBeta?.betaCanStart ?? false,
        passed: publicBeta?.passed ?? 0,
        total: publicBeta?.total ?? 0
      },
      testerRunbook: {
        ready: testerRunbookReady,
        path: testerRunbookPath,
        packetOverview: betaPacketOverviewPath
      },
      publicBetaSessionPlan: {
        ready: testerSessionPlanReady,
        path: sessionPlanPath,
        status: sessionPlan?.status ?? "missing",
        verification: statusLine(sessionPlanVerification?.status, sessionPlanVerification?.passed, sessionPlanVerification?.total),
        timeboxMinutes: sessionPlan?.sessionTimeboxMinutes ?? 0,
        phases: sessionPlan?.sessionPhases?.length ?? 0,
        launchPreflight: sessionPlan?.launchPreflight?.command ?? "missing"
      },
      publicBetaSessionReceipt: {
        ready: testerSessionReceiptReady,
        path: sessionReceiptTemplatePath,
        status: sessionReceiptValidation?.status ?? "missing",
        verification: statusLine(
          sessionReceiptValidation?.status,
          sessionReceiptValidation?.passed,
          sessionReceiptValidation?.total
        ),
        mode: sessionReceiptValidation?.mode ?? "missing",
        releaseDecision: sessionReceiptValidation?.releaseDecision ?? "missing",
        reviewOnly: sessionReceiptValidation?.reviewOnly ?? false,
        accepted: sessionReceiptValidation?.accepted ?? true,
        packagingGated: sessionReceiptValidation?.packagingGated ?? false,
        canRelease: sessionReceiptValidation?.canRelease ?? true
      },
      testerInvite: {
        status: testerInvite?.status ?? "not_built_yet",
        canInvite: testerInvite?.canInvite ?? false,
        failedReasons: testerInvite?.failedReasons ?? []
      },
      testerPreflight: {
        status: testerPreflight?.status ?? "not_run_yet",
        canInviteTester: testerPreflight?.canInviteTester ?? false,
        passed: testerPreflight?.passed ?? 0,
        total: testerPreflight?.total ?? 0
      },
      preparation: {
        status: publicBetaPreparation?.status ?? "missing",
        passed: publicBetaPreparation?.passed ?? 0,
        total: publicBetaPreparation?.total ?? 0
      },
      humanAcceptance: {
        gateStatus: humanGate?.status ?? "missing",
        latestEvidenceKind: humanGate?.latestEvidenceKind ?? "missing",
        latestHumanReviewed: humanGate?.latestHumanReviewed ?? false,
        latestAutomationGenerated: humanGate?.latestAutomationGenerated ?? false,
        reviewerKit: reviewerKit?.status ?? "missing",
        reviewerSteps: reviewerKit?.reviewerSteps?.length ?? 0,
        reviewerInvite: reviewerInvite?.status ?? "missing",
        reviewerInviteCanSend: reviewerInvite?.canInviteHumanReviewer ?? false,
        reviewerInviteVerification: statusLine(reviewerInviteVerification?.status, reviewerInviteVerification?.passed, reviewerInviteVerification?.total),
        reviewerInvitePath: "artifacts/productization/human-acceptance-reviewer-invite.md"
      },
      publicBetaFeedback: {
        collectionStatus: feedbackCollection?.status ?? "missing",
        totalReceipts: feedbackCollection?.totalReceipts ?? 0,
        validReceipts: feedbackCollection?.validReceipts ?? 0,
        invalidReceipts: feedbackCollection?.invalidReceipts ?? 0,
        collectionVerification: feedbackCollectionVerification?.status ?? "missing",
        followUpStatus: followUpPlan?.status ?? "missing",
        canInviteNextTester: followUpPlan?.canInviteNextTester ?? false,
        followUpActions: followUpPlan?.actions?.length ?? 0,
        followUpVerification: followUpPlanVerification?.status ?? "missing"
      },
      realModel: {
        activeProvider: ai.activeProvider,
        realModelReady: ai.realModelReady,
        adapterContractStatus: adapterContract?.status ?? "missing",
        adapterContractRealNetworkUsed: adapterContract?.realNetworkUsed ?? null,
        trialKitStatus: realModelKit?.status ?? "missing"
      },
      release: {
        status: releaseReadiness?.status ?? "missing",
        releaseDecision: releaseReadiness?.releaseDecision ?? "missing",
        blockerCount: releaseReadiness?.blockers?.length ?? 0,
        accepted: visualLearningAcceptanceGate.accepted,
        packagingGated: visualLearningAcceptanceGate.packagingGated
      }
    },
    immediateActions,
    blockedActions,
    nextAction:
      failedReasons.length === 0
        ? "Use this brief as the single next-step handoff: invite one bounded beta tester, process returned feedback through the follow-up plan, run real human acceptance, and plan real-model trial separately while release stays blocked."
        : "Fix failed operator brief reasons, then rebuild and verify this brief."
  };

  const markdown = `# Product Operator Brief

Status: \`${brief.status}\`

Scope: \`bounded_core_teaching_loop\`

Release decision: \`do_not_release\`

## Current Go / No-Go

| Decision | Value |
| --- | --- |
| Invite bounded beta tester | \`${brief.canInviteBoundedBetaTester}\` |
| Start real human acceptance review | \`${brief.canStartHumanAcceptanceReview}\` |
| Process returned public beta feedback | \`${brief.canProcessBetaFeedbackLoop}\` |
| Plan separate real-model trial | \`${brief.canPlanRealModelTrial}\` |
| Activate real model | \`false\` |
| Release product | \`false\` |
| Unlock packaging | \`false\` |

## Immediate Actions

${immediateActions
  .map(
    (action) => `### ${action.title}

- Allowed now: \`${action.allowed}\`
- Command: \`${action.command}\`
- Evidence: \`${action.evidencePath}\`
${"testerRunbookPath" in action ? `- Tester runbook: \`${action.testerRunbookPath}\`\n` : ""}${"sessionPlanPath" in action ? `- Session plan: \`${action.sessionPlanPath}\`\n` : ""}${"sessionReceiptTemplatePath" in action ? `- Session receipt template: \`${action.sessionReceiptTemplatePath}\`\n` : ""}- Stop condition: ${action.stopCondition}
`
  )
  .join("\n")}

## Blocked Actions

| Action | Reason |
| --- | --- |
${blockedActions.map((action) => `| ${markdownEscape(action.title)} | ${markdownEscape(action.reason)} |`).join("\n")}

## Source Evidence

| Area | Evidence |
| --- | --- |
| Doctor | \`${health?.status ?? "missing"} ${health?.passed ?? "?"}/${health?.total ?? "?"}\` |
| Smoke | \`${smoke?.status ?? "missing"} ${smoke?.passed ?? "?"}/${smoke?.total ?? "?"}\` |
| Handoff | \`${handoff?.status ?? "missing"} ${handoff?.passed ?? "?"}/${handoff?.total ?? "?"}\` |
| Public beta | \`${publicBeta?.status ?? "missing"} ${publicBeta?.passed ?? "?"}/${publicBeta?.total ?? "?"}; betaCanStart=${publicBeta?.betaCanStart ?? "missing"}\` |
| Tester runbook | \`ready=${testerRunbookReady}; path=${testerRunbookPath}\` |
| Public beta session plan | \`ready=${testerSessionPlanReady}; path=${sessionPlanPath}; verifier=${statusLine(sessionPlanVerification?.status, sessionPlanVerification?.passed, sessionPlanVerification?.total)}\` |
| Public beta session receipt | \`ready=${testerSessionReceiptReady}; path=${sessionReceiptTemplatePath}; verifier=${statusLine(sessionReceiptValidation?.status, sessionReceiptValidation?.passed, sessionReceiptValidation?.total)}; mode=${sessionReceiptValidation?.mode ?? "missing"}\` |
| Human acceptance | \`gate=${humanGate?.status ?? "missing"}; evidence=${humanGate?.latestEvidenceKind ?? "missing"}; humanReviewed=${humanGate?.latestHumanReviewed ?? "missing"}; invite=${reviewerInvite?.status ?? "missing"}; inviteVerification=${statusLine(reviewerInviteVerification?.status, reviewerInviteVerification?.passed, reviewerInviteVerification?.total)}\` |
| Public beta feedback | \`collection=${feedbackCollection?.status ?? "missing"}; followUp=${followUpPlan?.status ?? "missing"}; verifier=${followUpPlanVerification?.status ?? "missing"}\` |
| Real model | \`activeProvider=${ai.activeProvider}; realModelReady=${ai.realModelReady}; adapter=${adapterContract?.status ?? "missing"}\` |
| Release | \`${releaseReadiness?.status ?? "missing"}; blockers=${releaseReadiness?.blockers?.length ?? 0}; accepted=${visualLearningAcceptanceGate.accepted}; packagingGated=${visualLearningAcceptanceGate.packagingGated}\` |

## Boundary

- This brief is review-only.
- It keeps \`accepted=false\`, \`packagingGated=true\`, \`canRelease=false\`, \`canActivateRealModel=false\`, and \`allSoftwareObjective=paused\`.
- It cannot save acceptance, enable rules, activate a real model, unlock packaging, claim release readiness, or resume all-software scope.

## Failed Reasons

${failedReasons.length === 0 ? "- none" : failedReasons.map((reason) => `- ${reason}`).join("\n")}
`;

  fs.mkdirSync(artifactsDir, { recursive: true });
  fs.writeFileSync(briefJsonPath, JSON.stringify(brief, null, 2));
  fs.writeFileSync(briefMarkdownPath, markdown);
  return brief;
}

function main() {
  const brief = buildProductOperatorBrief();
  console.log(JSON.stringify(brief, null, 2));
  console.log(`\nProduct operator brief written to ${briefJsonPath}`);
  console.log(`Product operator brief Markdown written to ${briefMarkdownPath}`);

  if (brief.status !== "ready_for_operator_handoff") {
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



