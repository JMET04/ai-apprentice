import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const artifactsDir = path.join(process.cwd(), "artifacts", "productization");
const planJsonPath = path.join(artifactsDir, "public-beta-session-plan.json");
const planMarkdownPath = path.join(artifactsDir, "public-beta-session-plan.md");

function readJson<T>(relativePath: string): T | null {
  try {
    return JSON.parse(fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")) as T;
  } catch {
    return null;
  }
}

function evidenceSummary(status: string | undefined, passed: number | undefined, total: number | undefined) {
  return `${status ?? "missing"} ${passed ?? "?"}/${total ?? "?"}`;
}

function freshnessAllowsFirstRealBootstrap(receipt: {
  status?: string;
  releaseDecision?: string;
  allSoftwareObjective?: string;
  accepted?: boolean;
  packagingGated?: boolean;
  canRelease?: boolean;
  canActivateRealModel?: boolean;
  passed?: number;
  total?: number;
  checks?: Array<{ name?: string; pass?: boolean }>;
} | null) {
  if (
    receipt?.releaseDecision !== "do_not_release" ||
    receipt.allSoftwareObjective !== "paused" ||
    receipt.accepted !== false ||
    receipt.packagingGated !== true ||
    receipt.canRelease !== false ||
    receipt.canActivateRealModel !== false
  ) {
    return false;
  }

  if (receipt.status === "passed" && receipt.passed === receipt.total) {
    return true;
  }

  const failedChecks = (receipt.checks ?? []).filter((check) => check.pass !== true).map((check) => check.name ?? "missing");
  const allowedBootstrapFailures = new Set([
    "First real tester handoff chain is refreshed through final go/no-go",
    "Current status remains bounded beta only, not release ready"
  ]);

  return (
    receipt.status === "failed" &&
    Number(receipt.total ?? 0) >= 16 &&
    failedChecks.length > 0 &&
    failedChecks.every((name) => allowedBootstrapFailures.has(name)) &&
    (receipt.passed ?? 0) + failedChecks.length === receipt.total
  );
}
export function buildPublicBetaSessionPlan() {
  const readiness = readJson<{
    responseMode?: string;
    status?: string;
    betaCanStart?: boolean;
    releaseDecision?: string;
    passed?: number;
    total?: number;
  }>("artifacts/productization/public-beta-readiness.json");
  const invite = readJson<{
    responseMode?: string;
    status?: string;
    canInvite?: boolean;
    testerEntryPoints?: Record<string, string>;
  }>("artifacts/productization/public-beta-tester-invite.json");
  const followUpPlan = readJson<{
    responseMode?: string;
    status?: string;
    canInviteNextTester?: boolean;
  }>("artifacts/productization/public-beta-follow-up-plan.json");
  const packet = readJson<{
    responseMode?: string;
    status?: string;
    betaCanStart?: boolean;
    releaseDecision?: string;
  }>("artifacts/productization/public-beta-packet/public-beta-manifest.json");
  const feedbackCollectionVerification = readJson<{
    responseMode?: string;
    status?: string;
    passed?: number;
    total?: number;
  }>("artifacts/productization/public-beta-feedback-collection-verification.json");
  const returnIntakeVerification = readJson<{
    responseMode?: string;
    status?: string;
    passed?: number;
    total?: number;
  }>("artifacts/productization/public-beta-return-intake-verification.json");
  const releaseReadiness = readJson<{
    status?: string;
    releaseDecision?: string;
    blockers?: Array<{ name?: string; evidence?: string; nextAction?: string }>;
    boundary?: { accepted?: boolean; packagingGated?: boolean; activeProvider?: string };
  }>("artifacts/productization/product-release-readiness.json");
  const freshness = readJson<{
    status?: string;
    passed?: number;
    total?: number;
    releaseDecision?: string;
    allSoftwareObjective?: string;
    accepted?: boolean;
    packagingGated?: boolean;
    canRelease?: boolean;
    canActivateRealModel?: boolean;
    checks?: Array<{ name?: string; pass?: boolean }>;
  }>("artifacts/productization/productization-evidence-freshness.json");

  const failedReasons: string[] = [];
  const freshnessBootstrapAllowed = freshnessAllowsFirstRealBootstrap(freshness);
  const packetReady =
    packet?.responseMode === "public_beta_packet_manifest_json_v1" &&
    packet.status === "ready_for_public_beta" &&
    packet.betaCanStart === true &&
    packet.releaseDecision === "do_not_release";
  if (!packetReady && (readiness?.responseMode !== "public_beta_readiness_receipt_json_v1" || readiness.status !== "passed")) {
    failedReasons.push("public_beta_readiness_not_passed");
  }
  if (!packetReady && readiness?.betaCanStart !== true) failedReasons.push("public_beta_cannot_start");
  if (
    invite?.responseMode !== "public_beta_tester_invite_json_v1" ||
    invite.status !== "ready_to_invite" ||
    invite.canInvite !== true
  ) {
    failedReasons.push("tester_invite_not_ready");
  }
  if (followUpPlan?.responseMode !== "public_beta_follow_up_plan_json_v1" || followUpPlan.canInviteNextTester !== true) {
    failedReasons.push("follow_up_plan_does_not_allow_tester");
  }
  if (
    feedbackCollectionVerification?.responseMode !== "public_beta_feedback_collection_verification_json_v1" ||
    feedbackCollectionVerification.status !== "passed" ||
    feedbackCollectionVerification.passed !== feedbackCollectionVerification.total
  ) {
    failedReasons.push("feedback_collection_verification_not_passed");
  }
  if (
    returnIntakeVerification?.responseMode !== "public_beta_return_intake_verification_json_v1" ||
    returnIntakeVerification.status !== "passed" ||
    returnIntakeVerification.passed !== returnIntakeVerification.total
  ) {
    failedReasons.push("return_intake_verification_not_passed");
  }
  if (
    releaseReadiness?.releaseDecision !== "do_not_release" ||
    releaseReadiness.boundary?.accepted !== false ||
    releaseReadiness.boundary?.packagingGated !== true ||
    releaseReadiness.status !== "blocked_not_release_ready"
  ) {
    failedReasons.push("release_lock_not_preserved");
  }
  if (!freshnessBootstrapAllowed) {
    failedReasons.push("productization_freshness_not_locked_or_bootstrap_allowed");
  }

  const canStartSession = failedReasons.length === 0;
  const launchPreflight = {
    requiredImmediatelyBeforeContact: true,
    command: "npm run preflight:public-beta-tester -- --base-url http://127.0.0.1:3000",
    evidencePath: "artifacts/productization/public-beta-tester-session-preflight.json",
    stopIf:
      "Do not start the tester call if this preflight is missing, stale, failed, or changes releaseDecision/accepted/packagingGated."
  };
  const dayOfChecklist = [
    {
      phase: "before_contact",
      owner: "maintainer",
      action:
        "Start the product runtime, open /public-beta and /manual-test locally, run the tester preflight, and send the tester only the bounded beta URL plus PUBLIC_BETA_TESTER_RUNBOOK.md.",
      evidence: "artifacts/productization/public-beta-tester-session-preflight.json",
      stopCondition:
        "Stop before contact if the preflight fails, if tester materials are stale or missing, or if any lock differs from releaseDecision=do_not_release, accepted=false, packagingGated=true."
    },
    {
      phase: "during_session",
      owner: "facilitator",
      action:
        "Keep the tester inside the bounded core loop: run task-photo-travel-journal, inspect trace, submit one correction, review provenance, rerun, then save /manual-test human_review evidence.",
      evidence: "Visible product UI, tester notes, and artifacts/productization/manual-acceptance-latest.json after /manual-test save.",
      stopCondition:
        "Stop the session if the trace is missing, correction or provenance is unclear, /manual-test cannot save human_review evidence, or the tester loses trust in the loop."
    },
    {
      phase: "after_session",
      owner: "maintainer",
      action:
        "Collect the feedback receipt and session receipt, confirm both use the same tester.name/tester.date, confirm sessionEvidence.feedbackReceiptPath points at the submitted feedback receipt, validate both, run public-beta return intake, refresh collection and follow-up plan, then check release readiness remains blocked.",
      evidence:
        "artifacts/productization/public-beta-return-intake.json and refreshed artifacts/productization/public-beta-follow-up-plan.json.",
      stopCondition:
        "Do not invite another tester if either receipt is invalid, tester.name/tester.date do not match, sessionEvidence.feedbackReceiptPath does not point at the submitted feedback receipt, blocked, requests fixes before more testers, or implies production release, real-model acceptance, packaging unlock, or all-software scope."
    },
    {
      phase: "release_lock_audit",
      owner: "maintainer",
      action:
        "Confirm that the session produced review evidence only and that releaseDecision, accepted, packagingGated, canRelease, and allSoftwareObjective remain locked.",
      evidence: "artifacts/productization/product-release-readiness.json plus the returned session receipt.",
      stopCondition:
        "Stop if any evidence changes releaseDecision away from do_not_release, sets accepted=true, sets packagingGated=false, sets canRelease=true, activates a real model, or resumes all-software scope."
    }
  ];
  const sessionPhases = [
    {
      id: "pre_session_setup",
      timeboxMinutes: 5,
      owner: "maintainer",
      action:
        "Start or confirm the product server, open /public-beta, run the launch preflight, and send only the bounded beta links to one tester.",
      evidence: "artifacts/productization/public-beta-tester-session-preflight.json",
      stopCondition:
        "Stop if the product server, /public-beta, /manual-test, tester invite, return-intake path, or release lock check fails."
    },
    {
      id: "core_teaching_loop",
      timeboxMinutes: 15,
      owner: "tester",
      action: "Run task-photo-travel-journal once, inspect the public trace, submit one correction, confirm rule provenance, and rerun.",
      evidence: "Tester notes plus visible trace/rule provenance in the product UI.",
      stopCondition:
        "Stop if the task cannot run, public trace is missing, correction cannot be saved, or provenance is unclear enough to block trust."
    },
    {
      id: "human_review_evidence",
      timeboxMinutes: 8,
      owner: "tester",
      action: "Open /manual-test, enter reviewer notes, attest real human review, and save evidenceKind=human_review evidence.",
      evidence: "artifacts/productization/manual-acceptance-latest.json with evidenceKind=human_review and humanReviewed=true.",
      stopCondition: "Stop if reviewer identity, notes, attestation, or save confirmation is missing."
    },
    {
      id: "feedback_receipt_return",
      timeboxMinutes: 7,
      owner: "maintainer",
      action:
        "Collect the filled PUBLIC_BETA_FEEDBACK_RECEIPT JSON, fill the PUBLIC_BETA_SESSION_RECEIPT for the whole session with the same tester.name/tester.date, set sessionEvidence.feedbackReceiptPath to the submitted feedback receipt path, and immediately process both through validation and intake before inviting anyone else.",
      evidence:
        "Validated PUBLIC_BETA_SESSION_RECEIPT plus artifacts/productization/public-beta-return-intake.json and refreshed public-beta-follow-up-plan.json.",
      stopCondition:
        "Stop if either receipt is invalid, tester.name/tester.date do not match, sessionEvidence.feedbackReceiptPath does not point at the submitted feedback receipt, blocked, requests fixes before more testers, or implies release/all-software acceptance."
    }
  ];
  const returnPipeline = [
    "npm run verify:public-beta-feedback -- --receipt path/to/submitted-feedback.json",
    "npm run verify:public-beta-session-receipt -- --receipt path/to/filled-public-beta-session-receipt.json",
    "npm run intake:public-beta-return -- --receipt path/to/submitted-feedback.json --session-receipt path/to/filled-public-beta-session-receipt.json --send-receipt-validation artifacts/productization/first-real-tester-send-receipt-validation.json",
    "npm run verify:public-beta-feedback-collection",
    "npm run plan:public-beta-follow-up",
    "npm run verify:public-beta-follow-up-plan",
    "npm run verify:product-release-readiness -- --allow-blocked"
  ];
  const stopConditions = [
    "Live preflight is missing, stale, failed, or no longer preserves releaseDecision=do_not_release.",
    "Tester cannot complete the core teaching loop or cannot understand trace/rule provenance.",
    "No real /manual-test human_review evidence is saved.",
    "Returned feedback receipt is invalid, blocked, or asks for fixes before another tester.",
    "Any artifact claims production release, packaging unlock, real-model acceptance, or resumed all-software scope."
  ];

  const receiptBindingRule =
    "Feedback and whole-session receipts must use the same tester.name and tester.date, and the session receipt sessionEvidence.feedbackReceiptPath must resolve to the submitted feedback receipt; intake rejects mismatches before copying either receipt.";

  const plan = {
    responseMode: "public_beta_session_plan_json_v1",
    status: canStartSession ? "ready_for_session" : "not_ready_for_session",
    generatedAt: new Date().toISOString(),
    command: "npm run build:public-beta-session-plan",
    productScope: "bounded_core_teaching_loop",
    allSoftwareObjective: "paused",
    releaseDecision: "do_not_release",
    reviewOnly: true,
    accepted: false,
    packagingGated: true,
    canStartSession,
    failedReasons,
    sessionName: "One bounded beta tester session",
    sessionTimeboxMinutes: 35,
    launchPreflight,
    testerEntryPoints: {
      publicBeta: invite?.testerEntryPoints?.publicBeta ?? "http://127.0.0.1:3000/public-beta",
      runPage: invite?.testerEntryPoints?.runPage ?? "http://127.0.0.1:3000/tasks/task-photo-travel-journal/run",
      manualTest: invite?.testerEntryPoints?.manualTest ?? "http://127.0.0.1:3000/manual-test",
      feedbackReceiptTemplate:
        invite?.testerEntryPoints?.feedbackReceiptTemplate ??
        "artifacts/productization/public-beta-packet/docs/PUBLIC_BETA_FEEDBACK_RECEIPT.template.json",
      sessionReceiptTemplate: "artifacts/productization/public-beta-packet/docs/PUBLIC_BETA_SESSION_RECEIPT.template.json"
    },
    dayOfChecklist,
    sessionPhases,
    returnPipeline,
    receiptBindingRule,
    stopConditions,
    expectedReturnedEvidence: [
      "Filled PUBLIC_BETA_FEEDBACK_RECEIPT JSON.",
      "Filled PUBLIC_BETA_SESSION_RECEIPT JSON tying together live preflight, core loop evidence, manual-test evidence, feedback receipt path, return-intake status, blockers, and next action, with the same tester.name/tester.date as the feedback receipt and sessionEvidence.feedbackReceiptPath pointing at the submitted feedback receipt.",
      "Saved /manual-test evidenceKind=human_review with humanReviewed=true, or a blocker explaining why it could not be saved.",
      "Short note or screenshot for confusing wording, missing provenance, or trust blocker."
    ],
    sourceEvidence: {
      publicBetaReadiness: `${evidenceSummary(readiness?.status, readiness?.passed, readiness?.total)}; packet=${packet?.status ?? "missing"}`,
      testerInvite: `${invite?.status ?? "missing"}; canInvite=${invite?.canInvite ?? "missing"}`,
      feedbackCollectionVerification: evidenceSummary(
        feedbackCollectionVerification?.status,
        feedbackCollectionVerification?.passed,
        feedbackCollectionVerification?.total
      ),
      returnIntakeVerification: evidenceSummary(
        returnIntakeVerification?.status,
        returnIntakeVerification?.passed,
        returnIntakeVerification?.total
      ),
      followUpPlan: `${followUpPlan?.status ?? "missing"}; canInviteNextTester=${followUpPlan?.canInviteNextTester ?? "missing"}`,
      productizationEvidenceFreshness: `${evidenceSummary(freshness?.status, freshness?.passed, freshness?.total)}; bootstrapAllowed=${freshnessBootstrapAllowed}`,
      releaseReadiness: `${releaseReadiness?.status ?? "missing"}; release=${releaseReadiness?.releaseDecision ?? "missing"}; blockers=${releaseReadiness?.blockers?.length ?? 0}`
    },
    locks: {
      mustNotSaveAcceptance: true,
      mustNotEnableRules: true,
      mustNotUnlockPackaging: true,
      mustNotClaimReleaseReady: true,
      mustNotResumeAllSoftwareObjective: true,
      mustNotActivateRealModel: true
    },
    nextAction: canStartSession
      ? "Run the launch preflight immediately before contact, then host one bounded beta tester session using public-beta-session-plan.md."
      : "Fix failed readiness reasons before scheduling a beta tester session."
  };

  const markdown = `# Public Beta Session Plan

Status: \`${plan.status}\`

Can start session: \`${canStartSession}\`

Release decision: \`do_not_release\`

Session: ${plan.sessionName}

Timebox: ${plan.sessionTimeboxMinutes} minutes

## Launch Preflight

- Required immediately before contact: \`true\`
- Command: \`${launchPreflight.command}\`
- Evidence: \`${launchPreflight.evidencePath}\`
- Stop if: ${launchPreflight.stopIf}

## Day-Of Checklist

${dayOfChecklist
  .map(
    (item, index) =>
      `${index + 1}. ${item.phase} (${item.owner})
   - Action: ${item.action}
   - Evidence: ${item.evidence}
   - Stop if: ${item.stopCondition}`
  )
  .join("\n")}

## Facilitator Flow

${sessionPhases
  .map(
    (phase, index) =>
      `${index + 1}. ${phase.id} (${phase.timeboxMinutes} min, ${phase.owner})
   - Action: ${phase.action}
   - Evidence: ${phase.evidence}
   - Stop if: ${phase.stopCondition}`
  )
  .join("\n")}

## Return Pipeline

${returnPipeline.map((command) => `- \`${command}\``).join("\n")}

## Receipt Binding Rule

${receiptBindingRule}

## Expected Returned Evidence

${plan.expectedReturnedEvidence.map((item) => `- ${item}`).join("\n")}

## Stop Conditions

${stopConditions.map((item) => `- ${item}`).join("\n")}

## Source Evidence

| Area | Evidence |
| --- | --- |
${Object.entries(plan.sourceEvidence)
  .map(([key, value]) => `| ${key} | \`${String(value).replaceAll("|", "\\|")}\` |`)
  .join("\n")}

## Boundary

- This session plan is review-only.
- It does not save acceptance.
- It does not enable rules.
- It does not unlock packaging.
- It does not claim release readiness.
- It does not activate a real model.
- It does not resume all-software scope.

## Failed Reasons

${failedReasons.length === 0 ? "- none" : failedReasons.map((reason) => `- ${reason}`).join("\n")}
`;

  fs.mkdirSync(artifactsDir, { recursive: true });
  fs.writeFileSync(planJsonPath, JSON.stringify(plan, null, 2));
  fs.writeFileSync(planMarkdownPath, markdown);
  return plan;
}

function main() {
  const plan = buildPublicBetaSessionPlan();
  console.log(JSON.stringify(plan, null, 2));
  console.log(`\nPublic beta session plan written to ${planJsonPath}`);
  console.log(`Public beta session plan Markdown written to ${planMarkdownPath}`);

  if (plan.status !== "ready_for_session") {
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



