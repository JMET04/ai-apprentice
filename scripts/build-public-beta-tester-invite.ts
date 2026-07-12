import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const artifactsDir = path.join(process.cwd(), "artifacts", "productization");
const inviteJsonPath = path.join(artifactsDir, "public-beta-tester-invite.json");
const inviteMarkdownPath = path.join(artifactsDir, "public-beta-tester-invite.md");

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

function hasTesterLaunchGate(gate: {
  requiredImmediatelyBeforeContact?: boolean;
  command?: string;
  evidencePath?: string;
  stopIf?: string;
} | null | undefined) {
  return (
    gate?.requiredImmediatelyBeforeContact === true &&
    gate.command === "npm run preflight:public-beta-tester -- --base-url http://127.0.0.1:3000" &&
    gate.evidencePath === "artifacts/productization/public-beta-tester-session-preflight.json" &&
    gate.stopIf?.includes("Do not contact a tester") === true
  );
}

function expectedFollowUpStatus(collectionStatus: string | undefined) {
  if (collectionStatus === "waiting_for_feedback" || collectionStatus === "ready_for_next_beta_tester") {
    return collectionStatus;
  }
  if (collectionStatus === "has_invalid_feedback") return "invalid_feedback";
  if (collectionStatus === "blocked_by_beta_feedback") return "blocked_by_beta_feedback";
  if (collectionStatus === "needs_fix_before_more_testers") return "needs_fix_before_more_testers";
  return "missing_collection";
}

function generatedAtIsCurrentOrNewer(candidate: string | undefined, source: string | undefined) {
  if (!candidate || !source) return false;
  const candidateTime = Date.parse(candidate);
  const sourceTime = Date.parse(source);
  return Number.isFinite(candidateTime) && Number.isFinite(sourceTime) && candidateTime >= sourceTime;
}

export function buildPublicBetaTesterInvite() {
  const readiness = readJson<{
    responseMode?: string;
    status?: string;
    betaCanStart?: boolean;
    releaseDecision?: string;
    passed?: number;
    total?: number;
  }>("artifacts/productization/public-beta-readiness.json");
  const productizationEvidenceFreshness = readJson<{
    responseMode?: string;
    status?: string;
    releaseDecision?: string;
    allSoftwareObjective?: string;
    accepted?: boolean;
    packagingGated?: boolean;
    canRelease?: boolean;
    passed?: number;
    total?: number;
  }>("artifacts/productization/productization-evidence-freshness.json");
  const preparation = readJson<{
    responseMode?: string;
    status?: string;
    releaseDecision?: string;
    accepted?: boolean;
    packagingGated?: boolean;
    passed?: number;
    total?: number;
  }>("artifacts/productization/public-beta-preparation.json");
  const feedbackCollection = readJson<{
    responseMode?: string;
    status?: string;
    generatedAt?: string;
    releaseDecision?: string;
    reviewOnly?: boolean;
    accepted?: boolean;
    packagingGated?: boolean;
    totalReceipts?: number;
    validReceipts?: number;
    invalidReceipts?: number;
    testerLaunchGate?: {
      requiredImmediatelyBeforeContact?: boolean;
      command?: string;
      evidencePath?: string;
      stopIf?: string;
    } | null;
  }>("artifacts/productization/public-beta-feedback-collection.json");
  const feedbackCollectionVerification = readJson<{
    responseMode?: string;
    status?: string;
    releaseDecision?: string;
    accepted?: boolean;
    packagingGated?: boolean;
    passed?: number;
    total?: number;
  }>("artifacts/productization/public-beta-feedback-collection-verification.json");
  const followUpPlan = readJson<{
    responseMode?: string;
    status?: string;
    generatedAt?: string;
    sourceCollectionPath?: string;
    canInviteNextTester?: boolean;
    releaseDecision?: string;
    accepted?: boolean;
    packagingGated?: boolean;
    testerLaunchGate?: {
      requiredImmediatelyBeforeContact?: boolean;
      command?: string;
      evidencePath?: string;
      stopIf?: string;
    } | null;
    actionCount?: number;
    actions?: Array<{ id?: string; title?: string; command?: string; stopCondition?: string }>;
  }>("artifacts/productization/public-beta-follow-up-plan.json");
  const packet = readJson<{
    responseMode?: string;
    status?: string;
    betaCanStart?: boolean;
    releaseDecision?: string;
    requiredPassed?: number;
    requiredTotal?: number;
    includedFiles?: unknown[];
    blockers?: Array<{ name?: string; evidence?: string; nextAction?: string }>;
  }>("artifacts/productization/public-beta-packet/public-beta-manifest.json");
  const sessionReceiptValidation = readJson<{
    responseMode?: string;
    status?: string;
    mode?: string;
    releaseDecision?: string;
    reviewOnly?: boolean;
    accepted?: boolean;
    packagingGated?: boolean;
    canRelease?: boolean;
    passed?: number;
    total?: number;
  }>("artifacts/productization/public-beta-session-receipt-validation.json");
  const releaseReadiness = readJson<{
    responseMode?: string;
    status?: string;
    releaseDecision?: string;
    boundary?: { accepted?: boolean; packagingGated?: boolean };
    blockers?: Array<{ name?: string; evidence?: string; nextAction?: string }>;
  }>("artifacts/productization/product-release-readiness.json");
  const liveHandoff = readJson<{
    responseMode?: string;
    status?: string;
    releaseDecision?: string;
    passed?: number;
    total?: number;
  }>("artifacts/productization/live-product-handoff.json");

  const failedReasons: string[] = [];
  if (readiness?.responseMode !== "public_beta_readiness_receipt_json_v1" || readiness.status !== "passed") {
    failedReasons.push("public_beta_readiness_not_passed");
  }
  if (readiness?.betaCanStart !== true) {
    failedReasons.push("public_beta_cannot_start");
  }
  const preparationStepsGreen =
    preparation?.responseMode === "public_beta_preparation_receipt_json_v1" &&
    (preparation.status === "passed" || preparation.status === "running") &&
    Number(preparation.passed ?? 0) > 0 &&
    preparation.passed === preparation.total;

  if (!preparationStepsGreen) {
    failedReasons.push("public_beta_preparation_not_passed");
  }
  const expectedPlanStatus = expectedFollowUpStatus(feedbackCollection?.status);
  if (
    feedbackCollection?.responseMode !== "public_beta_feedback_collection_json_v1" ||
    !["waiting_for_feedback", "ready_for_next_beta_tester"].includes(feedbackCollection.status ?? "") ||
    feedbackCollection.releaseDecision !== "do_not_release" ||
    feedbackCollection.reviewOnly !== true ||
    feedbackCollection.accepted !== false ||
    feedbackCollection.packagingGated !== true ||
    !hasTesterLaunchGate(feedbackCollection.testerLaunchGate)
  ) {
    failedReasons.push("feedback_collection_does_not_allow_tester_intake");
  }
  if (
    feedbackCollectionVerification?.responseMode !== "public_beta_feedback_collection_verification_json_v1" ||
    feedbackCollectionVerification.status !== "passed" ||
    feedbackCollectionVerification.passed !== feedbackCollectionVerification.total ||
    Number(feedbackCollectionVerification.total ?? 0) < 7 ||
    feedbackCollectionVerification.releaseDecision !== "do_not_release" ||
    feedbackCollectionVerification.accepted !== false ||
    feedbackCollectionVerification.packagingGated !== true
  ) {
    failedReasons.push("feedback_collection_verification_not_passed");
  }
  if (
    followUpPlan?.responseMode !== "public_beta_follow_up_plan_json_v1" ||
    followUpPlan.canInviteNextTester !== true ||
    followUpPlan.status !== expectedPlanStatus ||
    !["waiting_for_feedback", "ready_for_next_beta_tester"].includes(followUpPlan.status ?? "") ||
    followUpPlan.sourceCollectionPath !== "artifacts/productization/public-beta-feedback-collection.json" ||
    !generatedAtIsCurrentOrNewer(followUpPlan.generatedAt, feedbackCollection?.generatedAt) ||
    !hasTesterLaunchGate(followUpPlan.testerLaunchGate)
  ) {
    failedReasons.push("follow_up_plan_does_not_match_current_feedback_collection");
  }
  const packetReady = packet?.responseMode === "public_beta_packet_manifest_json_v1" && packet.status === "ready_for_public_beta";
  const packetDeferredOnlyForInvite =
    packet?.responseMode === "public_beta_packet_manifest_json_v1" &&
    packet.status === "not_ready_for_public_beta" &&
    packet.releaseDecision === "do_not_release" &&
    packet.blockers?.length === 1 &&
    packet.blockers[0]?.name === "Public beta tester invite kit is ready and locked";

  if (!packetReady && !packetDeferredOnlyForInvite) {
    failedReasons.push("public_beta_packet_not_ready");
  }
  if (packetReady || packetDeferredOnlyForInvite) {
    for (const reason of ["public_beta_readiness_not_passed", "public_beta_cannot_start"]) {
      const index = failedReasons.indexOf(reason);
      if (index !== -1) failedReasons.splice(index, 1);
    }
  }
  const sessionReceiptReady =
    sessionReceiptValidation?.responseMode === "public_beta_session_receipt_validation_json_v1" &&
    sessionReceiptValidation.status === "template_ready" &&
    sessionReceiptValidation.mode === "template" &&
    sessionReceiptValidation.releaseDecision === "do_not_release" &&
    sessionReceiptValidation.reviewOnly === true &&
    sessionReceiptValidation.accepted === false &&
    sessionReceiptValidation.packagingGated === true &&
    sessionReceiptValidation.canRelease === false &&
    sessionReceiptValidation.passed === sessionReceiptValidation.total &&
    Number(sessionReceiptValidation.total ?? 0) >= 9;
  if (!sessionReceiptReady) {
    failedReasons.push("public_beta_session_receipt_template_not_ready");
  }
  if (liveHandoff?.responseMode !== "live_product_handoff_receipt_json_v1" || liveHandoff.status !== "passed") {
    failedReasons.push("live_handoff_not_passed");
  }
  if (
    releaseReadiness?.releaseDecision !== "do_not_release" ||
    releaseReadiness.boundary?.accepted !== false ||
    releaseReadiness.boundary?.packagingGated !== true
  ) {
    failedReasons.push("release_lock_not_preserved");
  }
  if (
    readiness?.releaseDecision !== "do_not_release" ||
    preparation?.releaseDecision !== "do_not_release" ||
    followUpPlan?.releaseDecision !== "do_not_release" ||
    packet?.releaseDecision !== "do_not_release" ||
    liveHandoff?.releaseDecision !== "do_not_release"
  ) {
    failedReasons.push("beta_artifact_release_decision_not_locked");
  }

  const canInvite = failedReasons.length === 0;
  const status = canInvite ? "ready_to_invite" : "not_ready_to_invite";
  const inviteMessage = [
    "Hi, could you run a bounded beta test of Transparent AI Apprentice?",
    "",
    "Please open http://127.0.0.1:3000/public-beta and use it as the session guide. The goal is to test the bounded teaching loop: run the demo task, inspect the public trace, submit one correction, confirm the new rule provenance, rerun, save /manual-test evidence, and return the public beta feedback receipt plus any notes or screenshots. The facilitator/maintainer will complete the whole-session receipt and bind it to your submitted feedback receipt.",
    "",
    "This is not a production release. Please do not treat beta feedback as product acceptance, packaging approval, release approval, or all-software control."
  ].join("\n");
  const maintainerChecklist = [
    "Confirm the local product server is reachable at http://127.0.0.1:3000/public-beta.",
    "Confirm artifacts/productization/productization-evidence-freshness.json is passed before contacting the tester.",
    "Run npm run preflight:public-beta-tester -- --base-url http://127.0.0.1:3000 immediately before contacting the tester and keep artifacts/productization/public-beta-tester-session-preflight.json with the returned evidence.",
    "Give the facilitator artifacts/productization/public-beta-packet/docs/PUBLIC_BETA_SESSION_PLAN.md and artifacts/productization/public-beta-packet/docs/PUBLIC_BETA_SESSION_RECEIPT.template.json before the session starts.",
    "Send the tester http://127.0.0.1:3000/public-beta, artifacts/productization/public-beta-packet/START_PUBLIC_BETA.md, and docs/PUBLIC_BETA_FEEDBACK_RECEIPT.template.json; keep docs/PUBLIC_BETA_SESSION_RECEIPT.template.json with the facilitator/maintainer.",
    "Ask the tester for a filled JSON feedback receipt, /manual-test human_review evidence, and any blocker notes; the facilitator/maintainer fills PUBLIC_BETA_SESSION_RECEIPT JSON after the session.",
    "Validate the returned feedback receipt with npm run verify:public-beta-feedback -- --receipt <path>.",
    "Validate the filled whole-session receipt with npm run verify:public-beta-session-receipt -- --receipt <path>.",
    "Process the returned feedback receipt with npm run intake:public-beta-return -- --receipt <path> --session-receipt <session-receipt-path> --send-receipt-validation artifacts/productization/first-real-tester-send-receipt-validation.json; this copies valid feedback into the inbox and refreshes collection plus follow-up planning.",
    "Run npm run verify:public-beta-feedback-collection and npm run verify:public-beta-follow-up-plan before inviting another tester."
  ];
  const testerChecklist = [
    "Open http://127.0.0.1:3000/public-beta.",
    "Use the Run stable task action or open http://127.0.0.1:3000/tasks/task-photo-travel-journal/run.",
    "Run the task once and inspect the structured public trace.",
    "Submit one correction and confirm a rule with source/provenance appears.",
    "Rerun and check whether the behavior changed in the expected way.",
    "Open http://127.0.0.1:3000/manual-test, add reviewer name and notes, attest real human review, and save evidence.",
    "Fill docs/PUBLIC_BETA_FEEDBACK_RECEIPT.template.json and return that JSON receipt plus any blocker notes or screenshots to the maintainer; the facilitator/maintainer fills docs/PUBLIC_BETA_SESSION_RECEIPT.template.json for the whole session."
  ];
  const locks = {
    mustNotSaveAcceptance: true,
    mustNotEnableRules: true,
    mustNotUnlockPackaging: true,
    mustNotClaimReleaseReady: true,
    mustNotResumeAllSoftwareObjective: true
  };

  const invite = {
    responseMode: "public_beta_tester_invite_json_v1",
    status,
    generatedAt: new Date().toISOString(),
    command: "npm run build:public-beta-tester-invite",
    productScope: "bounded_core_teaching_loop",
    allSoftwareObjective: "paused",
    releaseDecision: "do_not_release",
    reviewOnly: true,
    accepted: false,
    packagingGated: true,
    canInvite,
    failedReasons,
    launchPreflight: {
      requiredImmediatelyBeforeContact: true,
      command: "npm run preflight:public-beta-tester -- --base-url http://127.0.0.1:3000",
      evidencePath: "artifacts/productization/public-beta-tester-session-preflight.json",
      mustBeGeneratedAfterInvite: true,
      mustBeGeneratedAfterProductizationFreshness: true,
      stopIf:
        "Do not contact tester if this live preflight is missing, stale, failed, or releaseDecision is not do_not_release."
    },
    sourceEvidence: {
      publicBetaReadiness: {
        status: readiness?.status ?? "missing",
        betaCanStart: readiness?.betaCanStart ?? false,
        passed: readiness?.passed ?? 0,
        total: readiness?.total ?? 0
      },
      productizationEvidenceFreshness: {
        status: productizationEvidenceFreshness?.status ?? "missing",
        passed: productizationEvidenceFreshness?.passed ?? 0,
        total: productizationEvidenceFreshness?.total ?? 0,
        releaseDecision: productizationEvidenceFreshness?.releaseDecision ?? "missing"
      },
      publicBetaPreparation: {
        status: preparation?.status ?? "missing",
        passed: preparation?.passed ?? 0,
        total: preparation?.total ?? 0
      },
      publicBetaFeedbackCollection: {
        status: feedbackCollection?.status ?? "missing",
        generatedAt: feedbackCollection?.generatedAt ?? "missing",
        totalReceipts: feedbackCollection?.totalReceipts ?? 0,
        validReceipts: feedbackCollection?.validReceipts ?? 0,
        invalidReceipts: feedbackCollection?.invalidReceipts ?? 0,
        launchGate: hasTesterLaunchGate(feedbackCollection?.testerLaunchGate),
        verificationStatus: feedbackCollectionVerification?.status ?? "missing",
        verificationPassed: feedbackCollectionVerification?.passed ?? 0,
        verificationTotal: feedbackCollectionVerification?.total ?? 0
      },
      publicBetaFollowUpPlan: {
        status: followUpPlan?.status ?? "missing",
        expectedStatus: expectedPlanStatus,
        generatedAt: followUpPlan?.generatedAt ?? "missing",
        sourceCollectionPath: followUpPlan?.sourceCollectionPath ?? "missing",
        currentForFeedbackCollection: generatedAtIsCurrentOrNewer(followUpPlan?.generatedAt, feedbackCollection?.generatedAt),
        launchGate: hasTesterLaunchGate(followUpPlan?.testerLaunchGate),
        canInviteNextTester: followUpPlan?.canInviteNextTester ?? false,
        actionCount: followUpPlan?.actions?.length ?? followUpPlan?.actionCount ?? 0
      },
      publicBetaPacket: {
        status: packet?.status ?? "missing",
        betaCanStart: packet?.betaCanStart ?? false,
        requiredPassed: packet?.requiredPassed ?? 0,
        requiredTotal: packet?.requiredTotal ?? 0,
        includedFileCount: packet?.includedFiles?.length ?? 0,
        deferredOnlyForInvite: packetDeferredOnlyForInvite
      },
      publicBetaSessionReceipt: {
        status: sessionReceiptValidation?.status ?? "missing",
        mode: sessionReceiptValidation?.mode ?? "missing",
        passed: sessionReceiptValidation?.passed ?? 0,
        total: sessionReceiptValidation?.total ?? 0,
        releaseDecision: sessionReceiptValidation?.releaseDecision ?? "missing",
        reviewOnly: sessionReceiptValidation?.reviewOnly ?? false,
        accepted: sessionReceiptValidation?.accepted ?? true,
        packagingGated: sessionReceiptValidation?.packagingGated ?? false,
        canRelease: sessionReceiptValidation?.canRelease ?? true
      },
      liveHandoff: {
        status: liveHandoff?.status ?? "missing",
        passed: liveHandoff?.passed ?? 0,
        total: liveHandoff?.total ?? 0
      },
      releaseReadiness: {
        status: releaseReadiness?.status ?? "missing",
        releaseDecision: releaseReadiness?.releaseDecision ?? "missing",
        blockerCount: releaseReadiness?.blockers?.length ?? 0
      }
    },
    inviteMessage,
    maintainerChecklist,
    testerChecklist,
    expectedReturnedEvidence: [
      "Filled PUBLIC_BETA_FEEDBACK_RECEIPT JSON with status=submitted.",
      "Facilitator-filled PUBLIC_BETA_SESSION_RECEIPT JSON validated with npm run verify:public-beta-session-receipt -- --receipt <path> and bound to the submitted feedback receipt.",
      "/manual-test evidence saved as evidenceKind=human_review with humanReviewed=true.",
      "Optional screenshot or note path for blockers or confusing wording."
    ],
    testerEntryPoints: {
      publicBeta: "http://127.0.0.1:3000/public-beta",
      startHere: "artifacts/productization/public-beta-packet/START_PUBLIC_BETA.md",
      feedbackReceiptTemplate:
        "artifacts/productization/public-beta-packet/docs/PUBLIC_BETA_FEEDBACK_RECEIPT.template.json",
      facilitatorSessionReceiptTemplate:
        "artifacts/productization/public-beta-packet/docs/PUBLIC_BETA_SESSION_RECEIPT.template.json",
      dashboard: "http://127.0.0.1:3000",
      runPage: "http://127.0.0.1:3000/tasks/task-photo-travel-journal/run",
      manualTest: "http://127.0.0.1:3000/manual-test"
    },
    nextAction: canInvite
      ? "Run the launch preflight, then send public-beta-tester-invite.md and the public beta packet to one bounded beta tester."
      : "Fix failed invite readiness reasons, rerun npm run prepare:public-beta, then rebuild this invite kit.",
    locks
  };

  const markdown = `# Public Beta Tester Invite

Status: \`${status}\`

Can invite tester: \`${canInvite}\`

Release decision: \`do_not_release\`

## Message To Tester

${inviteMessage}

## Tester Entry Points

| Item | Path |
| --- | --- |
| Public beta session | ${invite.testerEntryPoints.publicBeta} |
| Start guide | \`${markdownEscape(invite.testerEntryPoints.startHere)}\` |
| Feedback receipt template | \`${markdownEscape(invite.testerEntryPoints.feedbackReceiptTemplate)}\` |
| Facilitator session receipt template | \`${markdownEscape(invite.testerEntryPoints.facilitatorSessionReceiptTemplate)}\` |
| Dashboard | ${invite.testerEntryPoints.dashboard} |
| Run page | ${invite.testerEntryPoints.runPage} |
| Manual test | ${invite.testerEntryPoints.manualTest} |

## Tester Checklist

${testerChecklist.map((item, index) => `${index + 1}. ${item}`).join("\n")}


## Launch Preflight

Before contacting the tester, run \`npm run preflight:public-beta-tester -- --base-url http://127.0.0.1:3000\`.

Evidence path: \`artifacts/productization/public-beta-tester-session-preflight.json\`

Stop if the live preflight is missing, stale, failed, or changes the release lock.

## Maintainer Checklist

${maintainerChecklist.map((item, index) => `${index + 1}. ${item}`).join("\n")}

## Expected Returned Evidence

${invite.expectedReturnedEvidence.map((item) => `- ${item}`).join("\n")}

## Boundary

- This invite is review-only.
- It does not save acceptance.
- It does not enable rules.
- It does not unlock packaging.
- It does not claim release readiness.
- It does not resume all-software scope.

## Failed Reasons

${failedReasons.length === 0 ? "- none" : failedReasons.map((reason) => `- ${reason}`).join("\n")}
`;

  fs.mkdirSync(artifactsDir, { recursive: true });
  fs.writeFileSync(inviteJsonPath, JSON.stringify(invite, null, 2));
  fs.writeFileSync(inviteMarkdownPath, markdown);
  return invite;
}

function main() {
  const invite = buildPublicBetaTesterInvite();
  console.log(JSON.stringify(invite, null, 2));
  console.log(`\nPublic beta tester invite written to ${inviteJsonPath}`);
  console.log(`Public beta tester invite Markdown written to ${inviteMarkdownPath}`);

  if (invite.status !== "ready_to_invite") {
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
