import fs from "node:fs";
import path from "node:path";
import {
  isPublicBetaGateReady,
  publicBetaGateStatusLine
} from "../src/server/productization/public-beta-recovery";

const rootDir = process.cwd();
const artifactsDir = path.join(rootDir, "artifacts", "productization");
const checklistJsonPath = path.join(artifactsDir, "productization-launch-checklist.json");
const checklistMarkdownPath = path.join(artifactsDir, "productization-launch-checklist.md");

function readJson<T>(relativePath: string): T | null {
  try {
    return JSON.parse(fs.readFileSync(path.join(rootDir, relativePath), "utf8")) as T;
  } catch {
    return null;
  }
}

function statusLine(status: string | undefined, passed?: number, total?: number) {
  if (typeof passed === "number" && typeof total === "number") return `${status ?? "missing"} ${passed}/${total}`;
  return status ?? "missing";
}

function markdownList(items: string[]) {
  return items.map((item) => `- ${item}`).join("\n");
}

function productTrialReadyForLaunch(receipt: {
  status?: string;
  passed?: number;
  total?: number;
  canRelease?: boolean;
  checks?: Array<{ name?: string; pass?: boolean }>;
} | null) {
  if (receipt?.canRelease !== false) return false;
  if (receipt.status === "passed" && receipt.passed === receipt.total) return true;

  const failedChecks = (receipt.checks ?? []).filter((check) => check.pass !== true).map((check) => check.name ?? "missing");
  return (
    receipt.status === "failed" &&
    failedChecks.length === 1 &&
    failedChecks[0] === "Productization freshness evidence is packaged and green" &&
    (receipt.passed ?? 0) + failedChecks.length === receipt.total
  );
}
function main() {
  const takeover = readJson<{
    status?: string;
    releaseDecision?: string;
    accepted?: boolean;
    packagingGated?: boolean;
    canRelease?: boolean;
    canActivateRealModel?: boolean;
    allowedActions?: Array<{ id?: string; allowed?: boolean; command?: string; evidencePath?: string; stopCondition?: string }>;
    blockedActions?: Array<{ id?: string; blocked?: boolean }>;
  }>("artifacts/productization/product-takeover-decision-matrix.json");
  const takeoverVerification = readJson<{ status?: string; passed?: number; total?: number }>(
    "artifacts/productization/product-takeover-decision-matrix-verification.json"
  );
  const statusSummary = readJson<{
    status?: string;
    betaCanStart?: boolean;
    canRelease?: boolean;
    canActivateRealModel?: boolean;
    releaseDecision?: string;
    accepted?: boolean;
    packagingGated?: boolean;
  }>("artifacts/productization/product-status-summary.json");
  const publicBeta = readJson<{
    status?: string;
    betaCanStart?: boolean;
    passed?: number;
    total?: number;
    releaseDecision?: string;
    checks?: Array<{ name?: string; pass?: boolean; evidence?: string }>;
  }>(
    "artifacts/productization/public-beta-readiness.json"
  );
  const productTrial = readJson<{
    status?: string;
    passed?: number;
    total?: number;
    canRelease?: boolean;
    checks?: Array<{ name?: string; pass?: boolean }>;
  }>(
    "artifacts/productization/product-trial-packet-verification.json"
  );
  const releaseBlockerBoard = readJson<{
    status?: string;
    releaseDecision?: string;
    accepted?: boolean;
    packagingGated?: boolean;
    canRelease?: boolean;
    lanes?: Array<{ id?: string; status?: string; stopCondition?: string }>;
  }>("artifacts/productization/product-release-blocker-board.json");
  const releaseBlockerVerification = readJson<{ status?: string; passed?: number; total?: number }>(
    "artifacts/productization/product-release-blocker-board-verification.json"
  );
  const humanInvite = readJson<{ status?: string; canInviteHumanReviewer?: boolean }>(
    "artifacts/productization/human-acceptance-reviewer-invite.json"
  );
  const humanInviteVerification = readJson<{ status?: string; passed?: number; total?: number }>(
    "artifacts/productization/human-acceptance-reviewer-invite-verification.json"
  );
  const humanPreflight = readJson<{ status?: string; canStartHumanAcceptance?: boolean; passed?: number; total?: number }>(
    "artifacts/productization/human-acceptance-session-preflight.json"
  );
  const betaPreflight = readJson<{ status?: string; canInviteTester?: boolean; passed?: number; total?: number }>(
    "artifacts/productization/public-beta-tester-session-preflight.json"
  );
  const realModelKit = readJson<{ status?: string; releaseDecision?: string; accepted?: boolean; packagingGated?: boolean }>(
    "artifacts/productization/real-model-trial-kit.json"
  );
  const realModelKitVerification = readJson<{ status?: string; passed?: number; total?: number }>(
    "artifacts/productization/real-model-trial-kit-verification.json"
  );
  const releaseApprovalValidation = readJson<{ status?: string; passed?: number; total?: number }>(
    "artifacts/productization/product-release-approval-validation.json"
  );

  const allowed = new Set((takeover?.allowedActions ?? []).filter((action) => action.allowed === true).map((action) => action.id));
  const publicBetaGateReadyForLaunch = isPublicBetaGateReady(publicBeta);
  const productTrialReady = productTrialReadyForLaunch(productTrial);
  const blocked = new Set((takeover?.blockedActions ?? []).filter((action) => action.blocked === true).map((action) => action.id));
  const failedReasons: string[] = [];

  if (takeover?.status !== "ready_for_takeover" || takeoverVerification?.status !== "passed") failedReasons.push("takeover_not_verified");
  if (statusSummary?.status !== "ready_for_bounded_beta_not_release") failedReasons.push("status_summary_not_ready");
  if (!publicBetaGateReadyForLaunch) failedReasons.push("public_beta_not_ready");
  if (!productTrialReady) failedReasons.push("product_trial_not_ready_or_unlocked");
  if (releaseBlockerBoard?.status !== "ready_for_blocker_resolution" || releaseBlockerVerification?.status !== "passed") {
    failedReasons.push("release_blocker_board_not_verified");
  }
  if (humanInvite?.status !== "ready_to_invite_reviewer" || humanInvite.canInviteHumanReviewer !== true) {
    failedReasons.push("human_reviewer_invite_not_ready");
  }
  if (humanInviteVerification?.status !== "passed" || humanInviteVerification.passed !== humanInviteVerification.total) {
    failedReasons.push("human_reviewer_invite_not_verified");
  }
  if (humanPreflight?.status !== "passed" || humanPreflight.canStartHumanAcceptance !== true) {
    failedReasons.push("human_acceptance_preflight_not_ready");
  }
  if (betaPreflight?.status !== "passed" || betaPreflight.canInviteTester !== true) {
    failedReasons.push("public_beta_preflight_not_ready");
  }
  if (realModelKit?.status !== "ready_for_real_model_trial_planning" || realModelKitVerification?.status !== "passed") {
    failedReasons.push("real_model_trial_kit_not_ready");
  }
  if (releaseApprovalValidation?.status !== "template_ready" || releaseApprovalValidation.passed !== releaseApprovalValidation.total) {
    failedReasons.push("release_approval_template_not_ready");
  }
  if (
    statusSummary?.releaseDecision !== "do_not_release" ||
    takeover?.releaseDecision !== "do_not_release" ||
    releaseBlockerBoard?.releaseDecision !== "do_not_release" ||
    statusSummary?.accepted !== false ||
    takeover?.accepted !== false ||
    releaseBlockerBoard?.accepted !== false ||
    statusSummary?.packagingGated !== true ||
    takeover?.packagingGated !== true ||
    releaseBlockerBoard?.packagingGated !== true ||
    statusSummary?.canRelease !== false ||
    takeover?.canRelease !== false ||
    releaseBlockerBoard?.canRelease !== false ||
    statusSummary?.canActivateRealModel !== false ||
    takeover?.canActivateRealModel !== false
  ) {
    failedReasons.push("productization_locks_not_preserved");
  }
  if (
    !allowed.has("invite_one_bounded_beta_tester") ||
    !allowed.has("run_real_human_acceptance_review") ||
    !allowed.has("process_returned_public_beta_feedback") ||
    !allowed.has("plan_real_model_trial_without_activation")
  ) {
    failedReasons.push("launch_actions_not_available");
  }
  if (!blocked.has("release_product") || !blocked.has("unlock_packaging") || !blocked.has("activate_real_model")) {
    failedReasons.push("release_only_transitions_not_blocked");
  }

  const lanes = [
    {
      id: "bounded_beta_tester",
      title: "Run one bounded beta tester session",
      allowed: allowed.has("invite_one_bounded_beta_tester"),
      command: "npm run preflight:public-beta-tester -- --base-url http://127.0.0.1:3000",
      evidencePath: "artifacts/productization/public-beta-packet/START_PUBLIC_BETA.md",
      requiredBeforeContact: [
        "artifacts/productization/public-beta-packet/docs/PUBLIC_BETA_TESTER_RUNBOOK.md",
        "artifacts/productization/public-beta-packet/docs/PUBLIC_BETA_SESSION_PLAN.md",
        "artifacts/productization/public-beta-packet/docs/PUBLIC_BETA_SESSION_RECEIPT.template.json"
      ],
      returnPath:
        "npm run intake:public-beta-return -- --receipt path/to/submitted-feedback.json --session-receipt path/to/filled-public-beta-session-receipt.json --send-receipt-validation artifacts/productization/first-real-tester-send-receipt-validation.json",
      stopCondition:
        "Stop if preflight fails, tester materials are missing, tester.name/tester.date do not match, sessionEvidence.feedbackReceiptPath does not point at the submitted feedback receipt, feedback is blocked, or releaseDecision is not do_not_release."
    },
    {
      id: "real_human_acceptance",
      title: "Run real human acceptance review",
      allowed: allowed.has("run_real_human_acceptance_review"),
      command: "npm run preflight:human-acceptance -- --base-url http://127.0.0.1:3000",
      evidencePath: "artifacts/productization/human-acceptance-reviewer-invite.md",
      requiredBeforeContact: [
        "artifacts/productization/human-acceptance-reviewer-kit.md",
        "artifacts/productization/human-acceptance-receipt.template.json"
      ],
      returnPath: "npm run intake:human-acceptance-return -- --receipt path/to/filled-human-acceptance-receipt.json --send-receipt-validation artifacts/productization/first-real-tester-send-receipt-validation.json",
      stopCondition:
        "Stop if /manual-test cannot save human_review evidence, reviewer attestation is missing, the receipt is invalid, or packaging becomes unlocked."
    },
    {
      id: "real_model_trial",
      title: "Plan real-model trial without activation",
      allowed: allowed.has("plan_real_model_trial_without_activation"),
      command: "npm run verify:real-model-adapter-contract",
      evidencePath: "artifacts/productization/real-model-trial-kit.md",
      redactionChecklistPath: "artifacts/productization/real-model-trial-kit.md#credential-redaction-checklist",
      requiredBeforeContact: ["artifacts/productization/real-model-trial-receipt.template.json"],
      returnPath: "npm run intake:real-model-trial-return -- --receipt path/to/filled-real-model-trial-receipt.json",
      stopCondition:
        "Stop if credentials would enter source control, realNetwork evidence is missing, the provider remains mock, or model acceptance is missing. Stop if the credential redaction checklist at artifacts/productization/real-model-trial-kit.md#credential-redaction-checklist is incomplete, returned artifacts contain secrets, or rollback_to_mock_after_trial is not confirmed."
    },
    {
      id: "release_approval_after_acceptance_only",
      title: "Process release approval only after acceptance evidence exists",
      allowed: allowed.has("process_returned_release_approval_receipt"),
      command: "npm run build:product-release-approval-template && npm run verify:product-release-approval",
      evidencePath: "artifacts/productization/product-release-approval-template.md",
      requiredBeforeContact: ["artifacts/productization/product-release-approval.template.json"],
      returnPath: "npm run intake:product-release-approval-return -- --receipt path/to/filled-product-release-approval.json",
      stopCondition:
        "Stop if human acceptance or real-model acceptance is missing, releaseDecision changes, accepted becomes true, or packaging becomes unlocked before explicit approval. Stop if prerequisiteEvidence.aiServiceStatusPath is missing, does not point to post-trial GET /api/ai-service-status JSON, or does not prove activeProvider=mock, realModelReady=false, manualProviderAcceptance=false, accepted=false, and packagingGated=true."
    }
  ];

  const checklist = {
    responseMode: "productization_launch_checklist_json_v1",
    status: failedReasons.length === 0 ? "ready_for_controlled_launch" : "needs_refresh",
    generatedAt: new Date().toISOString(),
    command: "npm run build:productization-launch-checklist",
    productScope: "bounded_core_teaching_loop",
    allSoftwareObjective: "paused",
    releaseDecision: "do_not_release",
    reviewOnly: true,
    accepted: false,
    packagingGated: true,
    canRelease: false,
    canActivateRealModel: false,
    sourceEvidence: {
      takeover: statusLine(takeover?.status, takeoverVerification?.passed, takeoverVerification?.total),
      statusSummary: statusSummary?.status ?? "missing",
      publicBeta: publicBetaGateStatusLine(publicBeta) ?? statusLine(publicBeta?.status, publicBeta?.passed, publicBeta?.total),
      productTrial: `${statusLine(productTrial?.status, productTrial?.passed, productTrial?.total)}; finalPackagePending=${productTrial?.status !== "passed" && productTrialReady}`,
      releaseBlockerBoard: statusLine(releaseBlockerBoard?.status, releaseBlockerVerification?.passed, releaseBlockerVerification?.total),
      humanInvite: `${humanInvite?.status ?? "missing"}; verifier=${statusLine(
        humanInviteVerification?.status,
        humanInviteVerification?.passed,
        humanInviteVerification?.total
      )}`,
      humanPreflight: statusLine(humanPreflight?.status, humanPreflight?.passed, humanPreflight?.total),
      betaPreflight: statusLine(betaPreflight?.status, betaPreflight?.passed, betaPreflight?.total),
      realModelKit: `${realModelKit?.status ?? "missing"}; verifier=${statusLine(
        realModelKitVerification?.status,
        realModelKitVerification?.passed,
        realModelKitVerification?.total
      )}`,
      releaseApprovalTemplate: statusLine(
        releaseApprovalValidation?.status,
        releaseApprovalValidation?.passed,
        releaseApprovalValidation?.total
      )
    },
    launchOrder: [
      "Refresh live preflights immediately before contacting a tester or reviewer.",
      "Run one bounded beta tester session and process returned feedback before expanding tester count.",
      "Run one real human acceptance review and process the returned receipt before using the evidence.",
      "Plan a real-model trial separately; do not activate the provider from planning material.",
      "Consider release approval only after human acceptance and real-model acceptance are both explicit."
    ],
    lanes,
    blockedTransitions: [
      "release_product",
      "unlock_packaging",
      "activate_real_model",
      "resume_all_software_scope"
    ],
    forbiddenOutcomes: [
      "Do not treat this checklist as acceptance.",
      "Do not enable rules from this checklist.",
      "Do not unlock packaging from this checklist.",
      "Do not activate a real model from this checklist.",
      "Do not claim release readiness from this checklist.",
      "Do not resume the all-software objective from this checklist."
    ],
    failedReasons,
    nextAction:
      failedReasons.length === 0
        ? "Use this checklist as the controlled launch page: run one bounded beta or one real human acceptance review while release stays locked."
        : "Refresh failed source evidence, rebuild the checklist, and verify it before contacting testers or reviewers."
  };

  const laneRows = lanes
    .map(
      (lane) =>
        `| ${lane.title} | \`${lane.allowed}\` | \`${lane.command}\` | \`${lane.evidencePath}\` | ${lane.stopCondition} |`
    )
    .join("\n");
  const evidenceRows = Object.entries(checklist.sourceEvidence)
    .map(([name, value]) => `| ${name} | \`${String(value)}\` |`)
    .join("\n");

  const markdown = `# Productization Launch Checklist

Status: \`${checklist.status}\`

Scope: \`${checklist.productScope}\`

Release decision: \`${checklist.releaseDecision}\`

This is the controlled launch page for the bounded productization track. It turns the current handoff evidence into a practical next-action checklist. It is not acceptance, release approval, model approval, or packaging unlock.

## Boundary

- All-software objective: \`${checklist.allSoftwareObjective}\`
- Review only: \`${checklist.reviewOnly}\`
- Accepted: \`${checklist.accepted}\`
- Packaging gated: \`${checklist.packagingGated}\`
- Can release: \`${checklist.canRelease}\`
- Can activate real model: \`${checklist.canActivateRealModel}\`

## Launch Order

${checklist.launchOrder.map((item, index) => `${index + 1}. ${item}`).join("\n")}

## Controlled Launch Lanes

| Lane | Allowed | Command | Evidence | Stop condition |
| --- | --- | --- | --- | --- |
${laneRows}

## Required Return Paths

${markdownList(lanes.map((lane) => `\`${lane.id}\`: \`${lane.returnPath}\``))}

## Source Evidence

| Source | Status |
| --- | --- |
${evidenceRows}

## Blocked Transitions

${markdownList(checklist.blockedTransitions.map((item) => `\`${item}\``))}

## Forbidden Outcomes

${markdownList(checklist.forbiddenOutcomes)}

## Failed Reasons

${failedReasons.length === 0 ? "- none" : markdownList(failedReasons)}

## Next Action

${checklist.nextAction}
`;

  fs.mkdirSync(artifactsDir, { recursive: true });
  fs.writeFileSync(checklistJsonPath, `${JSON.stringify(checklist, null, 2)}\n`, "utf8");
  fs.writeFileSync(checklistMarkdownPath, markdown, "utf8");
  console.log(JSON.stringify(checklist, null, 2));
  console.log(`\nProductization launch checklist written to ${checklistJsonPath}`);
  console.log(`Productization launch checklist Markdown written to ${checklistMarkdownPath}`);

  if (checklist.status !== "ready_for_controlled_launch") process.exitCode = 1;
}

try {
  main();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}

export {};
