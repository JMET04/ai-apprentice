import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { visualLearningAcceptanceGate } from "../src/lib/teacher-acceptance";
import { getAIServiceRuntimeStatus } from "../src/server/ai/service";

const artifactsDir = path.join(process.cwd(), "artifacts", "productization");
const boardJsonPath = path.join(artifactsDir, "product-release-blocker-board.json");
const boardMarkdownPath = path.join(artifactsDir, "product-release-blocker-board.md");

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

export function buildProductReleaseBlockerBoard() {
  const releaseReadiness = readJson<{
    responseMode?: string;
    status?: string;
    releaseDecision?: string;
    blockers?: Array<{ name?: string; evidence?: string; nextAction?: string }>;
    boundary?: { accepted?: boolean; packagingGated?: boolean; activeProvider?: string };
  }>("artifacts/productization/product-release-readiness.json");
  const humanGate = readJson<{
    responseMode?: string;
    status?: string;
    latestEvidenceKind?: string;
    latestHumanReviewed?: boolean;
    latestAutomationGenerated?: boolean;
  }>("artifacts/productization/human-acceptance-gate.json");
  const reviewerKit = readJson<{
    responseMode?: string;
    status?: string;
    canStartReviewerSession?: boolean;
  }>("artifacts/productization/human-acceptance-reviewer-kit.json");
  const reviewerKitVerification = readJson<{
    responseMode?: string;
    status?: string;
    passed?: number;
    total?: number;
  }>("artifacts/productization/human-acceptance-reviewer-kit-verification.json");
  const reviewerInvite = readJson<{
    responseMode?: string;
    status?: string;
    canInviteHumanReviewer?: boolean;
    failedReasons?: string[];
  }>("artifacts/productization/human-acceptance-reviewer-invite.json");
  const reviewerInviteVerification = readJson<{
    responseMode?: string;
    status?: string;
    passed?: number;
    total?: number;
  }>("artifacts/productization/human-acceptance-reviewer-invite-verification.json");
  const publicBeta = readJson<{
    responseMode?: string;
    status?: string;
    betaCanStart?: boolean;
    passed?: number;
    total?: number;
  }>("artifacts/productization/public-beta-readiness.json");
  const feedbackCollection = readJson<{
    responseMode?: string;
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
    responseMode?: string;
    status?: string;
    passed?: number;
    total?: number;
    releaseDecision?: string;
    accepted?: boolean;
    packagingGated?: boolean;
  }>("artifacts/productization/public-beta-feedback-collection-verification.json");
  const followUpPlan = readJson<{
    responseMode?: string;
    status?: string;
    canInviteNextTester?: boolean;
    releaseDecision?: string;
    reviewOnly?: boolean;
    accepted?: boolean;
    packagingGated?: boolean;
    actions?: unknown[];
  }>("artifacts/productization/public-beta-follow-up-plan.json");
  const followUpPlanVerification = readJson<{
    responseMode?: string;
    status?: string;
    passed?: number;
    total?: number;
    releaseDecision?: string;
    accepted?: boolean;
    packagingGated?: boolean;
  }>("artifacts/productization/public-beta-follow-up-plan-verification.json");
  const ai = getAIServiceRuntimeStatus();
  const releaseBlockers = releaseReadiness?.blockers ?? [];
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
  const releaseStillLocked =
    releaseReadiness?.status === "blocked_not_release_ready" &&
    releaseReadiness.releaseDecision === "do_not_release" &&
    releaseReadiness.boundary?.accepted === false &&
    releaseReadiness.boundary?.packagingGated === true &&
    visualLearningAcceptanceGate.accepted === false &&
    visualLearningAcceptanceGate.packagingGated === true;

  const lanes = [
    {
      id: "real_human_acceptance",
      title: "Real human acceptance",
      status:
        humanGate?.status === "passed" && humanGate.latestEvidenceKind === "human_review"
          ? "evidence_collected"
          : "blocked_needs_reviewer",
      blockerName: "Real human acceptance is complete",
      currentEvidence: `humanGate=${humanGate?.status ?? "missing"}; evidenceKind=${
        humanGate?.latestEvidenceKind ?? "missing"
      }; humanReviewed=${humanGate?.latestHumanReviewed ?? "missing"}; reviewerKit=${
        reviewerKit?.status ?? "missing"
      }; reviewerKitVerification=${reviewerKitVerification?.status ?? "missing"}; reviewerInvite=${
        reviewerInvite?.status ?? "missing"
      }; reviewerInviteVerification=${reviewerInviteVerification?.status ?? "missing"}; betaFeedback=${
        feedbackCollection?.status ?? "missing"
      }; betaFollowUp=${followUpPlan?.status ?? "missing"}`,
      evidencePaths: [
        "artifacts/productization/human-acceptance-reviewer-kit.md",
        "artifacts/productization/human-acceptance-reviewer-kit.json",
        "artifacts/productization/human-acceptance-reviewer-kit-verification.json",
        "artifacts/productization/human-acceptance-reviewer-invite.md",
        "artifacts/productization/human-acceptance-reviewer-invite.json",
        "artifacts/productization/human-acceptance-reviewer-invite-verification.json",
        "artifacts/productization/human-acceptance-receipt.template.json",
        "artifacts/productization/human-acceptance-receipt-validation.json",
        "artifacts/productization/human-acceptance-return-intake-verification.json",
        "artifacts/productization/public-beta-feedback-collection.json",
        "artifacts/productization/public-beta-feedback-collection-verification.json",
        "artifacts/productization/public-beta-follow-up-plan.json",
        "artifacts/productization/public-beta-follow-up-plan-verification.json",
        "artifacts/productization/public-beta-return-intake-verification.json",
        "artifacts/productization/manual-acceptance-latest.json",
        "artifacts/productization/human-acceptance-gate.json"
      ],
      commands: [
        "npm run preflight:human-acceptance -- --base-url http://127.0.0.1:3000",
        "npm run build:human-acceptance-reviewer-kit",
        "npm run verify:human-acceptance-reviewer-kit",
        "npm run build:human-acceptance-reviewer-invite",
        "npm run verify:human-acceptance-reviewer-invite",
        "npm run build:human-acceptance-receipt-template",
        "npm run verify:human-acceptance-receipt",
        "npm run intake:human-acceptance-return -- --receipt path/to/filled-human-acceptance-receipt.json --send-receipt-validation artifacts/productization/first-real-tester-send-receipt-validation.json",
        "npm run verify:human-acceptance-return-intake",
        "npm run collect:public-beta-feedback",
        "npm run verify:public-beta-feedback-collection",
        "npm run plan:public-beta-follow-up",
        "npm run verify:public-beta-follow-up-plan",
        "npm run preflight:public-beta-tester -- --base-url http://127.0.0.1:3000",
        "npm run intake:public-beta-return -- --receipt path/to/submitted-feedback.json --session-receipt path/to/filled-public-beta-session-receipt.json --send-receipt-validation artifacts/productization/first-real-tester-send-receipt-validation.json",
        "npm run verify:human-acceptance",
        "npm run verify:product-release-readiness -- --allow-blocked"
      ],
      continueCondition:
        "manual-acceptance-latest.json records evidenceKind=human_review, humanReviewed=true, reviewer attestation, every required step passed, and public beta returned feedback has been processed through the follow-up plan.",
      stopCondition:
        "Stop if latest evidence is automated_browser_smoke, reviewer attestation is missing, beta feedback is invalid/blocked/needs fixes, any required step is blocked, or verify:human-acceptance fails."
    },
    {
      id: "real_model_adapter",
      title: "Real model adapter acceptance",
      status: ai.realModelReady ? "real_provider_active_after_manual_acceptance" : "blocked_mock_or_unaccepted",
      blockerName: "Real model adapter is ready",
      currentEvidence: `activeProvider=${ai.activeProvider}; requestedProvider=${ai.requestedProvider}; realModelReady=${ai.realModelReady}; status=${ai.status}`,
      evidencePaths: [
        "src/server/ai/service.ts",
        "src/server/ai/openai-service.ts",
        ".env.example",
        "artifacts/productization/real-model-adapter-contract-verification.json",
        "artifacts/productization/real-model-trial-kit.md",
        "artifacts/productization/real-model-trial-kit.json",
        "artifacts/productization/real-model-trial-kit-verification.json",
        "artifacts/productization/real-model-trial-receipt.template.json",
        "artifacts/productization/real-model-trial-receipt-validation.json",
        "artifacts/productization/real-model-trial-return-intake-verification.json",
        "artifacts/productization/product-release-readiness.json"
      ],
      commands: [
        "GET /api/ai-service-status",
        "npm run verify:real-model-adapter-contract",
        "npm run build:real-model-trial-kit",
        "npm run verify:real-model-trial-kit",
        "npm run build:real-model-trial-receipt-template",
        "npm run verify:real-model-trial-receipt",
        "npm run intake:real-model-trial-return -- --receipt path/to/filled-real-model-trial-receipt.json",
        "npm run verify:real-model-trial-return-intake",
        "npm run verify:product",
        "npm run smoke:product -- --base-url http://127.0.0.1:3000",
        "npm run verify:product-release-readiness -- --allow-blocked"
      ],
      continueCondition:
        "A supported real provider is configured outside source control, AI_PROVIDER_MANUAL_ACCEPTED=true only after a separate model trial, and /api/ai-service-status reports realModelReady=true.",
      stopCondition:
        "Stop if activeProvider remains mock, credentials are missing, provider is unknown, or model output has not received separate human acceptance."
    },
    {
      id: "packaging_release_lock",
      title: "Packaging and release approval",
      status: releaseStillLocked ? "locked_expected" : "needs_lock_audit",
      blockerName: "Packaging and release lock is intentionally still closed",
      currentEvidence: `accepted=${visualLearningAcceptanceGate.accepted}; packagingGated=${visualLearningAcceptanceGate.packagingGated}; status=${visualLearningAcceptanceGate.status}; releaseDecision=${
        releaseReadiness?.releaseDecision ?? "missing"
      }`,
      evidencePaths: [
        "src/lib/teacher-acceptance.ts",
        "artifacts/productization/product-release-readiness.json",
        "artifacts/productization/product-release-approval.template.json",
        "artifacts/productization/product-release-approval-validation.json",
        "artifacts/productization/product-release-approval-return-intake-verification.json",
        "artifacts/productization/product-trial-packet/product-trial-manifest.json",
        "artifacts/productization/public-beta-packet/public-beta-manifest.json"
      ],
      commands: [
        "npm run build:product-release-approval-template",
        "npm run verify:product-release-approval",
        "npm run intake:product-release-approval-return -- --receipt path/to/filled-product-release-approval.json",
        "npm run verify:product-release-approval-return-intake",
        "npm run verify:handoff",
        "npm run verify:public-beta",
        "npm run verify:product-release-readiness -- --allow-blocked"
      ],
      continueCondition:
        "Only after real human acceptance and real-model acceptance are explicit may a separate release approval process decide whether to unlock packaging.",
      stopCondition:
        "Stop if any beta, handoff, reviewer-kit, or feedback artifact claims accepted=true, packagingGated=false, or releaseDecision other than do_not_release before explicit release approval."
    }
  ];

  const failedReasons: string[] = [];
  if (releaseReadiness?.responseMode !== "product_release_readiness_gate_json_v1") {
    failedReasons.push("release_readiness_missing");
  }
  if (!releaseStillLocked) {
    failedReasons.push("release_lock_not_preserved");
  }
  if (releaseBlockers.length < 3) {
    failedReasons.push("release_blockers_incomplete");
  }
  if (reviewerKit?.status !== "ready_for_reviewer" || reviewerKitVerification?.status !== "passed") {
    failedReasons.push("human_reviewer_kit_not_ready");
  }
  if (
    reviewerInvite?.status !== "ready_to_invite_reviewer" ||
    reviewerInvite.canInviteHumanReviewer !== true ||
    reviewerInviteVerification?.status !== "passed"
  ) {
    failedReasons.push("human_reviewer_invite_not_ready");
  }
  if (publicBeta?.status !== "passed" || publicBeta.betaCanStart !== true) {
    failedReasons.push("public_beta_not_ready");
  }
  if (!betaFeedbackLoopReady) {
    failedReasons.push("public_beta_feedback_loop_not_ready");
  }

  const board = {
    responseMode: "product_release_blocker_board_json_v1",
    status: failedReasons.length === 0 ? "ready_for_blocker_resolution" : "needs_productization_work",
    generatedAt: new Date().toISOString(),
    command: "npm run build:product-release-blocker-board",
    productScope: "bounded_core_teaching_loop",
    allSoftwareObjective: "paused",
    releaseDecision: "do_not_release",
    reviewOnly: true,
    accepted: false,
    packagingGated: true,
    canRelease: false,
    canActivateRealModel: false,
    failedReasons,
    sourceEvidence: {
      releaseReadiness: {
        path: "artifacts/productization/product-release-readiness.json",
        status: releaseReadiness?.status ?? "missing",
        releaseDecision: releaseReadiness?.releaseDecision ?? "missing",
        blockerCount: releaseBlockers.length
      },
      humanAcceptance: {
        gateStatus: humanGate?.status ?? "missing",
        evidenceKind: humanGate?.latestEvidenceKind ?? "missing",
        humanReviewed: humanGate?.latestHumanReviewed ?? false,
        reviewerKit: reviewerKit?.status ?? "missing",
        reviewerKitVerification: reviewerKitVerification?.status ?? "missing",
        reviewerInvite: reviewerInvite?.status ?? "missing",
        reviewerInviteCanSend: reviewerInvite?.canInviteHumanReviewer ?? false,
        reviewerInviteVerification: reviewerInviteVerification?.status ?? "missing"
      },
      aiService: {
        activeProvider: ai.activeProvider,
        requestedProvider: ai.requestedProvider,
        status: ai.status,
        realModelReady: ai.realModelReady
      },
      packagingBoundary: {
        accepted: visualLearningAcceptanceGate.accepted,
        packagingGated: visualLearningAcceptanceGate.packagingGated,
        status: visualLearningAcceptanceGate.status
      },
      publicBeta: {
        status: publicBeta?.status ?? "missing",
        betaCanStart: publicBeta?.betaCanStart ?? false,
        passed: publicBeta?.passed ?? 0,
        total: publicBeta?.total ?? 0
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
      }
    },
    lanes,
    forbiddenTransitions: [
      "Do not save acceptance from this board.",
      "Do not enable rules from this board.",
      "Do not unlock packaging from this board.",
      "Do not claim release readiness from this board.",
      "Do not accept a real model from this board.",
      "Do not resume all-software scope from this board."
    ],
    nextAction:
      failedReasons.length === 0
        ? "Resolve lanes in order: real human acceptance, separate real-model trial acceptance, then explicit packaging/release approval."
        : "Fix failed blocker-board readiness reasons before using it for release follow-up planning."
  };

  const markdown = `# Product Release Blocker Board

Status: \`${board.status}\`

Release decision: \`do_not_release\`

Can release: \`false\`

Can activate real model: \`false\`

## Blocker Lanes

| Lane | Status | Evidence |
| --- | --- | --- |
${lanes
  .map((lane) => `| ${markdownEscape(lane.title)} | \`${lane.status}\` | ${markdownEscape(lane.currentEvidence)} |`)
  .join("\n")}

## Commands By Lane

${lanes
  .map(
    (lane) => `### ${lane.title}

${lane.commands.map((command) => `- \`${command}\``).join("\n")}

Continue condition: ${lane.continueCondition}

Stop condition: ${lane.stopCondition}
`
  )
  .join("\n")}

## Boundary

- This board is review-only.
- It keeps \`accepted=false\`, \`packagingGated=true\`, \`canRelease=false\`, \`canActivateRealModel=false\`, \`releaseDecision=do_not_release\`, and \`allSoftwareObjective=paused\`.
- It does not save acceptance, enable rules, unlock packaging, claim release readiness, accept a real model, or resume all-software scope.

## Failed Reasons

${failedReasons.length === 0 ? "- none" : failedReasons.map((reason) => `- ${reason}`).join("\n")}
`;

  fs.mkdirSync(artifactsDir, { recursive: true });
  fs.writeFileSync(boardJsonPath, JSON.stringify(board, null, 2));
  fs.writeFileSync(boardMarkdownPath, markdown);
  return board;
}

function main() {
  const board = buildProductReleaseBlockerBoard();
  console.log(JSON.stringify(board, null, 2));
  console.log(`\nProduct release blocker board written to ${boardJsonPath}`);
  console.log(`Product release blocker board Markdown written to ${boardMarkdownPath}`);

  if (board.status !== "ready_for_blocker_resolution") {
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
