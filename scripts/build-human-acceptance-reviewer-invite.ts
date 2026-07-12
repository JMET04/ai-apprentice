import fs from "node:fs";
import path from "node:path";

const rootDir = process.cwd();
const artifactsDir = path.join(rootDir, "artifacts", "productization");
const inviteJsonPath = path.join(artifactsDir, "human-acceptance-reviewer-invite.json");
const inviteMarkdownPath = path.join(artifactsDir, "human-acceptance-reviewer-invite.md");
const stableTaskId = "task-photo-travel-journal";

function readJson<T>(relativePath: string): T | null {
  try {
    return JSON.parse(fs.readFileSync(path.join(rootDir, relativePath), "utf8")) as T;
  } catch {
    return null;
  }
}

function fileEvidence(relativePath: string) {
  const fullPath = path.join(rootDir, relativePath);
  return {
    path: relativePath,
    exists: fs.existsSync(fullPath),
    bytes: fs.existsSync(fullPath) ? fs.statSync(fullPath).size : 0
  };
}

function statusLine(status: string | undefined, passed?: number, total?: number) {
  if (typeof passed === "number" && typeof total === "number") return `${status ?? "missing"} ${passed}/${total}`;
  return status ?? "missing";
}

function main() {
  const preflight = readJson<{
    responseMode?: string;
    status?: string;
    baseUrl?: string;
    canStartHumanAcceptance?: boolean;
    releaseDecision?: string;
    reviewOnly?: boolean;
    accepted?: boolean;
    packagingGated?: boolean;
    canRelease?: boolean;
    canActivateRealModel?: boolean;
    passed?: number;
    total?: number;
  }>("artifacts/productization/human-acceptance-session-preflight.json");
  const reviewerKit = readJson<{
    responseMode?: string;
    status?: string;
    generatedAt?: string;
    canStartReviewerSession?: boolean;
    releaseDecision?: string;
    reviewOnly?: boolean;
    accepted?: boolean;
    packagingGated?: boolean;
    canRelease?: boolean;
    canActivateRealModel?: boolean;
    reviewerSteps?: unknown[];
  }>("artifacts/productization/human-acceptance-reviewer-kit.json");
  const reviewerKitVerification = readJson<{
    responseMode?: string;
    status?: string;
    generatedAt?: string;
    releaseDecision?: string;
    accepted?: boolean;
    packagingGated?: boolean;
    canRelease?: boolean;
    canActivateRealModel?: boolean;
    passed?: number;
    total?: number;
  }>("artifacts/productization/human-acceptance-reviewer-kit-verification.json");
  const receiptValidation = readJson<{
    responseMode?: string;
    status?: string;
    generatedAt?: string;
    releaseDecision?: string;
    accepted?: boolean;
    packagingGated?: boolean;
    canRelease?: boolean;
    canActivateRealModel?: boolean;
    passed?: number;
    total?: number;
  }>("artifacts/productization/human-acceptance-receipt-validation.json");
  const returnIntakeVerification = readJson<{
    responseMode?: string;
    status?: string;
    generatedAt?: string;
    releaseDecision?: string;
    accepted?: boolean;
    packagingGated?: boolean;
    canRelease?: boolean;
    canActivateRealModel?: boolean;
    passed?: number;
    total?: number;
  }>("artifacts/productization/human-acceptance-return-intake-verification.json");
  const humanGate = readJson<{
    responseMode?: string;
    status?: string;
    latestEvidenceKind?: string;
    latestHumanReviewed?: boolean;
  }>("artifacts/productization/human-acceptance-gate.json");
  const releaseReadiness = readJson<{
    responseMode?: string;
    status?: string;
    releaseDecision?: string;
    blockers?: Array<{ name?: string; evidence?: string; nextAction?: string }>;
    boundary?: { accepted?: boolean; packagingGated?: boolean; activeProvider?: string };
  }>("artifacts/productization/product-release-readiness.json");
  const statusSummary = readJson<{
    responseMode?: string;
    status?: string;
    betaCanStart?: boolean;
    canRelease?: boolean;
    canActivateRealModel?: boolean;
    releaseDecision?: string;
    accepted?: boolean;
    packagingGated?: boolean;
  }>("artifacts/productization/product-status-summary.json");

  const failedReasons: string[] = [];
  if (
    preflight?.responseMode !== "human_acceptance_session_preflight_json_v1" ||
    preflight.status !== "passed" ||
    preflight.canStartHumanAcceptance !== true ||
    preflight.releaseDecision !== "do_not_release" ||
    preflight.accepted !== false ||
    preflight.packagingGated !== true ||
    preflight.passed !== preflight.total
  ) {
    failedReasons.push("human_acceptance_preflight_not_ready");
  }
  if (
    reviewerKit?.responseMode !== "human_acceptance_reviewer_kit_json_v1" ||
    reviewerKit.status !== "ready_for_reviewer" ||
    reviewerKit.canStartReviewerSession !== true ||
    reviewerKit.releaseDecision !== "do_not_release" ||
    reviewerKit.accepted !== false ||
    reviewerKit.packagingGated !== true ||
    Number(reviewerKit.reviewerSteps?.length ?? 0) < 6
  ) {
    failedReasons.push("reviewer_kit_not_ready");
  }
  if (
    reviewerKitVerification?.responseMode !== "human_acceptance_reviewer_kit_verification_json_v1" ||
    reviewerKitVerification.status !== "passed" ||
    reviewerKitVerification.passed !== reviewerKitVerification.total ||
    reviewerKitVerification.releaseDecision !== "do_not_release" ||
    reviewerKitVerification.accepted !== false ||
    reviewerKitVerification.packagingGated !== true
  ) {
    failedReasons.push("reviewer_kit_verification_not_passed");
  }
  if (
    receiptValidation?.responseMode !== "human_acceptance_receipt_validation_json_v1" ||
    receiptValidation.status !== "template_ready" ||
    receiptValidation.passed !== receiptValidation.total ||
    receiptValidation.releaseDecision !== "do_not_release" ||
    receiptValidation.accepted !== false ||
    receiptValidation.packagingGated !== true
  ) {
    failedReasons.push("human_acceptance_receipt_template_not_ready");
  }
  if (
    returnIntakeVerification?.responseMode !== "human_acceptance_return_intake_verification_json_v1" ||
    returnIntakeVerification.status !== "passed" ||
    returnIntakeVerification.passed !== returnIntakeVerification.total ||
    returnIntakeVerification.releaseDecision !== "do_not_release" ||
    returnIntakeVerification.accepted !== false ||
    returnIntakeVerification.packagingGated !== true
  ) {
    failedReasons.push("human_acceptance_return_intake_not_verified");
  }
  if (
    releaseReadiness?.releaseDecision !== "do_not_release" ||
    releaseReadiness.boundary?.accepted !== false ||
    releaseReadiness.boundary?.packagingGated !== true ||
    statusSummary?.canRelease !== false ||
    statusSummary?.canActivateRealModel !== false ||
    statusSummary?.releaseDecision !== "do_not_release"
  ) {
    failedReasons.push("release_lock_not_preserved");
  }
  if (humanGate?.responseMode !== "human_acceptance_gate_json_v1" || humanGate.status !== "blocked_needs_human_review") {
    failedReasons.push("human_gate_not_waiting_for_real_reviewer");
  }

  const baseUrl = preflight?.baseUrl ?? "http://127.0.0.1:3000";
  const canInviteHumanReviewer = failedReasons.length === 0;
  const status = canInviteHumanReviewer ? "ready_to_invite_reviewer" : "not_ready_to_invite_reviewer";
  const inviteMessage = [
    "Hi, could you run a real human acceptance review for Transparent AI Apprentice?",
    "",
    `Please use ${baseUrl}/manual-test as the reviewer workbench. The bounded product scope is the core teaching loop: run the stable task, inspect the public trace, check rule provenance after a correction, rerun, then save real human_review evidence with reviewer notes and attestation.`,
    "",
    "This is not a production release. Your review can produce human acceptance evidence, but it does not unlock packaging, approve a real model, approve release, or resume the all-software objective."
  ].join("\n");
  const maintainerChecklist = [
    `Start or confirm the product server at ${baseUrl} before contacting the reviewer.`,
    "Run npm run preflight:human-acceptance -- --base-url http://127.0.0.1:3000 immediately before sending the invite.",
    "Send artifacts/productization/human-acceptance-reviewer-invite.md, artifacts/productization/human-acceptance-reviewer-kit.md, and artifacts/productization/human-acceptance-receipt.template.json to the reviewer.",
    "Ask the reviewer to save /manual-test human_review evidence and return a filled human acceptance receipt JSON.",
    "Validate the returned receipt with npm run verify:human-acceptance-receipt -- --receipt <path>.",
    "Archive the returned receipt with npm run intake:human-acceptance-return -- --receipt <path> --send-receipt-validation artifacts/productization/first-real-tester-send-receipt-validation.json.",
    "Run npm run verify:human-acceptance after the real reviewer evidence is saved.",
    "Run npm run verify:product-release-readiness -- --allow-blocked after human acceptance verification; release should still remain locked unless real-model and release approval evidence also exist."
  ];
  const reviewerChecklist = [
    `Open ${baseUrl}/manual-test and confirm the manual acceptance workbench is visible.`,
    `Open ${baseUrl}/tasks/${stableTaskId}/run and run the stable task once.`,
    `Open ${baseUrl}/tasks/${stableTaskId}/review and inspect the structured public trace, evidence, and rule provenance.`,
    "Submit or inspect one correction and confirm the reusable rule provenance remains visible and review-bound.",
    "Rerun the stable task and record whether the correction changed behavior as expected.",
    "Return to /manual-test, enter reviewer name, mark every required step passed or blocked, add per-step notes, confirm attestation, and save evidence.",
    "Fill human-acceptance-receipt.template.json and return the filled JSON to the maintainer."
  ];
  const launchPreflight = {
    requiredImmediatelyBeforeContact: true,
    command: "npm run preflight:human-acceptance -- --base-url http://127.0.0.1:3000",
    evidencePath: "artifacts/productization/human-acceptance-session-preflight.json",
    mustBeGeneratedAfterReviewerKit: true,
    mustPreserveReleaseLock: true,
    stopIf:
      "Do not contact reviewer if preflight fails, /manual-test is unreachable, latest evidence already claims acceptance incorrectly, releaseDecision changes, or accepted/packaging locks change."
  };
  const expectedReturnedEvidence = [
    "artifacts/productization/manual-acceptance-latest.json with evidenceKind=human_review and humanReviewed=true.",
    "A filled human acceptance receipt validated with npm run verify:human-acceptance-receipt -- --receipt <path>.",
    "artifacts/productization/human-acceptance-gate.json refreshed by npm run verify:human-acceptance.",
    "artifacts/productization/product-release-readiness.json refreshed with releaseDecision=do_not_release unless all separate blockers are resolved.",
    "Optional screenshots or blocker notes for any failed reviewer step."
  ];
  const sourceEvidence = {
    humanAcceptancePreflight: {
      status: preflight?.status ?? "missing",
      canStartHumanAcceptance: preflight?.canStartHumanAcceptance ?? false,
      passed: preflight?.passed ?? 0,
      total: preflight?.total ?? 0
    },
    reviewerKit: {
      status: reviewerKit?.status ?? "missing",
      canStartReviewerSession: reviewerKit?.canStartReviewerSession ?? false,
      canRelease: reviewerKit?.canRelease ?? false,
      canActivateRealModel: reviewerKit?.canActivateRealModel ?? false,
      steps: reviewerKit?.reviewerSteps?.length ?? 0,
      verificationStatus: reviewerKitVerification?.status ?? "missing",
      verificationCanRelease: reviewerKitVerification?.canRelease ?? false,
      verificationCanActivateRealModel: reviewerKitVerification?.canActivateRealModel ?? false,
      verificationPassed: reviewerKitVerification?.passed ?? 0,
      verificationTotal: reviewerKitVerification?.total ?? 0
    },
    receiptTemplate: {
      status: receiptValidation?.status ?? "missing",
      canRelease: receiptValidation?.canRelease ?? false,
      canActivateRealModel: receiptValidation?.canActivateRealModel ?? false,
      passed: receiptValidation?.passed ?? 0,
      total: receiptValidation?.total ?? 0
    },
    returnIntake: {
      status: returnIntakeVerification?.status ?? "missing",
      canRelease: returnIntakeVerification?.canRelease ?? false,
      canActivateRealModel: returnIntakeVerification?.canActivateRealModel ?? false,
      passed: returnIntakeVerification?.passed ?? 0,
      total: returnIntakeVerification?.total ?? 0
    },
    humanAcceptanceGate: {
      status: humanGate?.status ?? "missing",
      latestEvidenceKind: humanGate?.latestEvidenceKind ?? "missing",
      latestHumanReviewed: humanGate?.latestHumanReviewed ?? false
    },
    releaseReadiness: {
      status: releaseReadiness?.status ?? "missing",
      releaseDecision: releaseReadiness?.releaseDecision ?? "missing",
      accepted: releaseReadiness?.boundary?.accepted ?? "missing",
      packagingGated: releaseReadiness?.boundary?.packagingGated ?? "missing",
      blockerCount: releaseReadiness?.blockers?.length ?? 0
    },
    statusSummary: {
      status: statusSummary?.status ?? "missing",
      betaCanStart: statusSummary?.betaCanStart ?? false,
      canRelease: statusSummary?.canRelease ?? true,
      canActivateRealModel: statusSummary?.canActivateRealModel ?? false
    }
  };
  const locks = {
    mustNotSaveAcceptanceFromInvite: true,
    mustNotEnableRules: true,
    mustNotUnlockPackaging: true,
    mustNotClaimReleaseReady: true,
    mustNotAcceptRealModel: true,
    mustNotResumeAllSoftwareObjective: true
  };
  const invite = {
    responseMode: "human_acceptance_reviewer_invite_json_v1",
    status,
    generatedAt: new Date().toISOString(),
    command: "npm run build:human-acceptance-reviewer-invite",
    productScope: "bounded_core_teaching_loop",
    stableTaskId,
    allSoftwareObjective: "paused",
    releaseDecision: "do_not_release",
    reviewOnly: true,
    accepted: false,
    packagingGated: true,
    canRelease: false,
    canActivateRealModel: false,
    canInviteHumanReviewer,
    failedReasons,
    baseUrl,
    inviteMessage,
    maintainerChecklist,
    reviewerChecklist,
    launchPreflight,
    reviewerEntrypoints: {
      manualTest: `${baseUrl}/manual-test`,
      stableTaskRun: `${baseUrl}/tasks/${stableTaskId}/run`,
      stableTaskReview: `${baseUrl}/tasks/${stableTaskId}/review`,
      reviewerKit: "artifacts/productization/human-acceptance-reviewer-kit.md",
      receiptTemplate: "artifacts/productization/human-acceptance-receipt.template.json"
    },
    expectedReturnedEvidence,
    sourceEvidence,
    forbiddenOutcomes: [
      "Do not treat this invite as product acceptance.",
      "Do not enable rules from this invite.",
      "Do not unlock packaging from this invite.",
      "Do not claim release readiness from this invite.",
      "Do not claim real-model acceptance from this invite.",
      "Do not resume the all-software objective from this invite."
    ],
    nextAction: canInviteHumanReviewer
      ? "Run the human acceptance preflight immediately before contact, then send human-acceptance-reviewer-invite.md to one real reviewer."
      : "Fix failed invite readiness reasons, rerun preflight and reviewer-kit commands, then rebuild this invite.",
    locks,
    generatedFiles: [
      fileEvidence("artifacts/productization/human-acceptance-reviewer-invite.json"),
      fileEvidence("artifacts/productization/human-acceptance-reviewer-invite.md")
    ]
  };

  const markdown = `# Human Acceptance Reviewer Invite

Status: \`${status}\`

Can invite human reviewer: \`${canInviteHumanReviewer}\`

Release decision: \`do_not_release\`

Accepted: \`false\`

Packaging gated: \`true\`

Can release: \`false\`

Can activate real model: \`false\`

Stable task: \`${stableTaskId}\`

## Message To Send

${inviteMessage}

## Launch Preflight

- Required immediately before contact: \`${launchPreflight.requiredImmediatelyBeforeContact}\`
- Command: \`${launchPreflight.command}\`
- Evidence: \`${launchPreflight.evidencePath}\`
- Stop if: ${launchPreflight.stopIf}

## Reviewer Entrypoints

- Manual test: \`${invite.reviewerEntrypoints.manualTest}\`
- Stable task run: \`${invite.reviewerEntrypoints.stableTaskRun}\`
- Stable task review: \`${invite.reviewerEntrypoints.stableTaskReview}\`
- Reviewer kit: \`${invite.reviewerEntrypoints.reviewerKit}\`
- Receipt template: \`${invite.reviewerEntrypoints.receiptTemplate}\`

## Maintainer Checklist

${maintainerChecklist.map((item) => `- ${item}`).join("\n")}

## Reviewer Checklist

${reviewerChecklist.map((item) => `- ${item}`).join("\n")}

## Expected Returned Evidence

${expectedReturnedEvidence.map((item) => `- ${item}`).join("\n")}

## Source Evidence

| Area | Evidence |
| --- | --- |
| Human acceptance preflight | \`${statusLine(preflight?.status, preflight?.passed, preflight?.total)}; canStart=${preflight?.canStartHumanAcceptance ?? "missing"}\` |
| Reviewer kit | \`${reviewerKit?.status ?? "missing"}; verification=${statusLine(reviewerKitVerification?.status, reviewerKitVerification?.passed, reviewerKitVerification?.total)}\` |
| Receipt template | \`${statusLine(receiptValidation?.status, receiptValidation?.passed, receiptValidation?.total)}\` |
| Return intake | \`${statusLine(returnIntakeVerification?.status, returnIntakeVerification?.passed, returnIntakeVerification?.total)}\` |
| Human acceptance gate | \`${humanGate?.status ?? "missing"}; evidence=${humanGate?.latestEvidenceKind ?? "missing"}; humanReviewed=${humanGate?.latestHumanReviewed ?? "missing"}\` |
| Release readiness | \`${releaseReadiness?.status ?? "missing"}; decision=${releaseReadiness?.releaseDecision ?? "missing"}; blockers=${releaseReadiness?.blockers?.length ?? 0}\` |

## Boundary

- This invite is review-only.
- It keeps \`accepted=false\`, \`packagingGated=true\`, \`canRelease=false\`, \`canActivateRealModel=false\`, and \`allSoftwareObjective=paused\`.
- It cannot save acceptance, enable rules, accept a real model, unlock packaging, claim release readiness, or resume all-software scope.

## Failed Reasons

${failedReasons.length === 0 ? "- none" : failedReasons.map((reason) => `- ${reason}`).join("\n")}
`;

  fs.mkdirSync(artifactsDir, { recursive: true });
  fs.writeFileSync(inviteJsonPath, `${JSON.stringify(invite, null, 2)}\n`, "utf8");
  fs.writeFileSync(inviteMarkdownPath, markdown, "utf8");
  console.log(JSON.stringify(invite, null, 2));
  console.log(`\nHuman acceptance reviewer invite written to ${inviteJsonPath}`);
  console.log(`Human acceptance reviewer invite Markdown written to ${inviteMarkdownPath}`);

  if (status !== "ready_to_invite_reviewer") {
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