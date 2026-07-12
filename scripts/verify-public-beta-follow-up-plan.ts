import fs from "node:fs";
import path from "node:path";
import { buildPublicBetaFollowUpPlan } from "./plan-public-beta-follow-up";

type VerificationCheck = {
  name: string;
  pass: boolean;
  evidence: string;
};

const artifactsDir = path.join(process.cwd(), "artifacts", "productization");
const tempRoot = path.join(artifactsDir, "public-beta-follow-up-plan-verification-tmp");
const receiptPath = path.join(artifactsDir, "public-beta-follow-up-plan-verification.json");

function push(checks: VerificationCheck[], name: string, pass: boolean, evidence: string) {
  checks.push({ name, pass, evidence });
}

function collection(status: string, receipts: unknown[] = []) {
  const validReceipts = receipts.filter((receipt) => (receipt as { valid?: boolean }).valid === true);
  const invalidReceipts = receipts.filter((receipt) => (receipt as { valid?: boolean }).valid === false);

  return {
    responseMode: "public_beta_feedback_collection_json_v1",
    status,
    generatedAt: "2026-06-24T00:00:00.000Z",
    command: "npm run collect:public-beta-feedback",
    inboxDir: "artifacts/productization/public-beta-feedback-inbox",
    productScope: "bounded_core_teaching_loop",
    allSoftwareObjective: "paused",
    releaseDecision: "do_not_release",
    reviewOnly: true,
    accepted: false,
    packagingGated: true,
    totalReceipts: receipts.length,
    validReceipts: validReceipts.length,
    invalidReceipts: invalidReceipts.length,
    decisionCounts: {
      ready_for_next_beta_tester: validReceipts.filter(
        (receipt) => (receipt as { betaDecision?: string }).betaDecision === "ready_for_next_beta_tester"
      ).length,
      needs_fix_before_more_testers: validReceipts.filter(
        (receipt) => (receipt as { betaDecision?: string }).betaDecision === "needs_fix_before_more_testers"
      ).length,
      blocked: validReceipts.filter((receipt) => (receipt as { betaDecision?: string }).betaDecision === "blocked")
        .length
    },
    receipts,
    nextAction: "Scenario fixture."
  };
}

function receipt(betaDecision: string, overrides: Record<string, unknown> = {}) {
  return {
    file: `${betaDecision}.json`,
    valid: true,
    testerName: "Beta Tester",
    testerDate: "2026-06-24",
    betaDecision,
    blocker: betaDecision === "blocked" ? "Navigation blocked the tester." : "",
    nextActionRecommendation:
      betaDecision === "needs_fix_before_more_testers" ? "Clarify the correction workflow." : "Continue.",
    failedChecks: [],
    ...overrides
  };
}

function runScenario(name: string, body: unknown | null) {
  const dir = path.join(tempRoot, name);
  const collectionPath = path.join(dir, "collection.json");
  const outputPath = path.join(dir, "plan.json");
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });

  if (body) {
    fs.writeFileSync(collectionPath, JSON.stringify(body, null, 2));
  }

  return buildPublicBetaFollowUpPlan({ collectionPath, outputPath });
}

function locked(plan: ReturnType<typeof buildPublicBetaFollowUpPlan>) {
  return (
    plan.releaseDecision === "do_not_release" &&
    plan.reviewOnly === true &&
    plan.accepted === false &&
    plan.packagingGated === true &&
    plan.locks.mustNotSaveAcceptance === true &&
    plan.locks.mustNotUnlockPackaging === true &&
    plan.locks.mustNotClaimReleaseReady === true &&
    plan.locks.mustNotResumeAllSoftwareObjective === true
  );
}

function hasTesterLaunchGate(plan: ReturnType<typeof buildPublicBetaFollowUpPlan>, actionId: string) {
  const action = plan.actions.find((item) => item.id === actionId);

  return (
    action?.lane === "tester_intake" &&
    action.command === "npm run preflight:public-beta-tester -- --base-url http://127.0.0.1:3000" &&
    action.launchPreflight?.requiredImmediatelyBeforeContact === true &&
    action.launchPreflight.command === "npm run preflight:public-beta-tester -- --base-url http://127.0.0.1:3000" &&
    action.launchPreflight.evidencePath === "artifacts/productization/public-beta-tester-session-preflight.json" &&
    action.launchPreflight.stopIf.includes("Do not contact a tester") &&
    action.continueCondition.includes("live preflight passes immediately before contact") &&
    action.stopCondition.includes("live preflight is missing")
  );
}

function main() {
  const checks: VerificationCheck[] = [];
  fs.rmSync(tempRoot, { recursive: true, force: true });

  const missing = runScenario("missing", null);
  push(
    checks,
    "Missing collection blocks tester intake until collection runs",
    missing.status === "missing_collection" &&
      missing.canInviteNextTester === false &&
      missing.actions.some((item) => item.id === "collect-feedback-inbox") &&
      locked(missing),
    `status=${missing.status}; invite=${missing.canInviteNextTester}; actions=${missing.actions.length}`
  );

  const waiting = runScenario("waiting", collection("waiting_for_feedback"));
  push(
    checks,
    "Waiting feedback can invite the first bounded tester",
    waiting.status === "waiting_for_feedback" &&
      waiting.canInviteNextTester === true &&
      waiting.actions.some((item) => item.id === "invite-first-bounded-beta-tester") &&
      locked(waiting),
    `status=${waiting.status}; invite=${waiting.canInviteNextTester}; actions=${waiting.actions.length}`
  );

  const ready = runScenario("ready", collection("ready_for_next_beta_tester", [receipt("ready_for_next_beta_tester")]));
  push(
    checks,
    "Ready feedback can invite only the next bounded tester",
    ready.status === "ready_for_next_beta_tester" &&
      ready.canInviteNextTester === true &&
      ready.actions.some((item) => item.id === "invite-next-bounded-beta-tester") &&
      locked(ready),
    `status=${ready.status}; invite=${ready.canInviteNextTester}; actions=${ready.actions.length}`
  );

  push(
    checks,
    "Tester intake actions require live preflight before contact",
    waiting.testerLaunchGate?.requiredImmediatelyBeforeContact === true &&
      ready.testerLaunchGate?.requiredImmediatelyBeforeContact === true &&
      hasTesterLaunchGate(waiting, "invite-first-bounded-beta-tester") &&
      hasTesterLaunchGate(ready, "invite-next-bounded-beta-tester") &&
      waiting.nextAction.includes("Run the live tester preflight") &&
      ready.nextAction.includes("Run the live tester preflight"),
    `waitingGate=${waiting.testerLaunchGate?.requiredImmediatelyBeforeContact ?? false}; readyGate=${
      ready.testerLaunchGate?.requiredImmediatelyBeforeContact ?? false
    }; waitingAction=${hasTesterLaunchGate(waiting, "invite-first-bounded-beta-tester")}; readyAction=${hasTesterLaunchGate(
      ready,
      "invite-next-bounded-beta-tester"
    )}`
  );

  const needsFix = runScenario(
    "needs-fix",
    collection("needs_fix_before_more_testers", [receipt("needs_fix_before_more_testers")])
  );
  push(
    checks,
    "Needs-fix feedback blocks more tester intake",
    needsFix.status === "needs_fix_before_more_testers" &&
      needsFix.canInviteNextTester === false &&
      needsFix.actions.some((item) => item.id === "plan-beta-fixes-before-more-testers") &&
      needsFix.needsFixReceipts.length === 1 &&
      locked(needsFix),
    `status=${needsFix.status}; invite=${needsFix.canInviteNextTester}; needsFix=${needsFix.needsFixReceipts.length}`
  );

  const blocked = runScenario("blocked", collection("blocked_by_beta_feedback", [receipt("blocked")]));
  push(
    checks,
    "Blocked feedback stops tester intake and preserves blockers",
    blocked.status === "blocked_by_beta_feedback" &&
      blocked.canInviteNextTester === false &&
      blocked.actions.some((item) => item.id === "review-beta-blockers") &&
      blocked.blockerReceipts[0]?.blocker === "Navigation blocked the tester." &&
      locked(blocked),
    `status=${blocked.status}; invite=${blocked.canInviteNextTester}; blockers=${blocked.blockerReceipts.length}`
  );

  const invalid = runScenario(
    "invalid",
    collection("has_invalid_feedback", [
      receipt("ready_for_next_beta_tester", {
        file: "invalid.json",
        valid: false,
        failedChecks: ["tester_identity", "locked_review_only_boundary"]
      })
    ])
  );
  push(
    checks,
    "Invalid feedback blocks planning until receipts are repaired",
    invalid.status === "invalid_feedback" &&
      invalid.canInviteNextTester === false &&
      invalid.actions.some((item) => item.id === "repair-invalid-feedback-receipts") &&
      invalid.invalidReceipts[0]?.failedChecks.includes("locked_review_only_boundary") &&
      locked(invalid),
    `status=${invalid.status}; invite=${invalid.canInviteNextTester}; invalid=${invalid.invalidReceipts.length}`
  );

  fs.rmSync(tempRoot, { recursive: true, force: true });

  const passed = checks.filter((check) => check.pass).length;
  const verification = {
    responseMode: "public_beta_follow_up_plan_verification_json_v1",
    status: passed === checks.length ? "passed" : "failed",
    generatedAt: new Date().toISOString(),
    command: "npm run verify:public-beta-follow-up-plan",
    productScope: "bounded_core_teaching_loop",
    allSoftwareObjective: "paused",
    releaseDecision: "do_not_release",
    reviewOnly: true,
    accepted: false,
    packagingGated: true,
    passed,
    total: checks.length,
    checks,
    nextAction:
      passed === checks.length
        ? "Follow-up planning behavior is verified; use public-beta-follow-up-plan.json and run the live tester preflight before bounded beta intake."
        : "Fix follow-up planning behavior before inviting more beta testers."
  };

  fs.mkdirSync(artifactsDir, { recursive: true });
  fs.writeFileSync(receiptPath, JSON.stringify(verification, null, 2));
  console.log(JSON.stringify(verification, null, 2));
  console.log(`\nPublic beta follow-up plan verification written to ${receiptPath}`);

  if (verification.status !== "passed") {
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
