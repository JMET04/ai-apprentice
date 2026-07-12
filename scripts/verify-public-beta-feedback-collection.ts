import fs from "node:fs";
import path from "node:path";
import { collectPublicBetaFeedback } from "./collect-public-beta-feedback";

type VerificationCheck = {
  name: string;
  pass: boolean;
  evidence: string;
};

const artifactsDir = path.join(process.cwd(), "artifacts", "productization");
const tempRoot = path.join(artifactsDir, "public-beta-feedback-collection-verification-tmp");
const receiptPath = path.join(artifactsDir, "public-beta-feedback-collection-verification.json");

function push(checks: VerificationCheck[], name: string, pass: boolean, evidence: string) {
  checks.push({ name, pass, evidence });
}

function baseReceipt(betaDecision: "ready_for_next_beta_tester" | "needs_fix_before_more_testers" | "blocked") {
  return {
    responseMode: "public_beta_feedback_receipt_template_json_v1",
    status: "submitted",
    productScope: "bounded_core_teaching_loop",
    allSoftwareObjective: "paused",
    releaseDecision: "do_not_release",
    betaDecisionAllowedValues: ["ready_for_next_beta_tester", "needs_fix_before_more_testers", "blocked"],
    defaultBetaDecision: "needs_fix_before_more_testers",
    reviewOnly: true,
    accepted: false,
    packagingGated: true,
    tester: {
      name: "Beta Tester",
      role: "trial reviewer",
      date: "2026-06-23",
      environment: "local product runtime"
    },
    setup: {
      couldStartProductRuntime: true,
      healthEndpointHealthy: true,
      liveHandoffChecked: true,
      notes: "Runtime started and health was checked."
    },
    coreLoop: {
      firstRunClear: true,
      traceUnderstandable: true,
      correctionSubmitted: true,
      ruleProvenanceVisible: true,
      rerunChangedBehavior: true,
      notes: "Core loop was reviewed."
    },
    trustAndBoundaries: {
      learnedBehaviorClear: true,
      reviewOnlyBoundaryClear: true,
      noReleaseOrAllSoftwareClaim: true,
      notes: "Release and all-software boundaries stayed visible."
    },
    blockers: {
      blockingIssue: betaDecision === "blocked" ? "Tester found a blocking workflow issue." : "",
      confusingWording: "",
      missingProductBehavior: "",
      screenshotOrEvidencePath: ""
    },
    betaDecision,
    nextActionRecommendation:
      betaDecision === "ready_for_next_beta_tester"
        ? "Proceed to another bounded beta tester."
        : betaDecision === "blocked"
          ? "Stop beta intake and review the blocker."
          : "Fix the confusing behavior before inviting more testers.",
    locks: {
      mustNotSaveAcceptance: true,
      mustNotEnableRules: true,
      mustNotUnlockPackaging: true,
      mustNotClaimReleaseReady: true,
      mustNotResumeAllSoftwareObjective: true
    }
  };
}

function writeReceipt(dir: string, name: string, value: unknown) {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, name), JSON.stringify(value, null, 2));
}

function runScenario(name: string, receipts: Array<{ name: string; body: unknown }>) {
  const inboxDir = path.join(tempRoot, name, "inbox");
  const outputPath = path.join(tempRoot, name, "collection.json");
  fs.rmSync(path.dirname(inboxDir), { recursive: true, force: true });
  fs.mkdirSync(inboxDir, { recursive: true });

  for (const receipt of receipts) {
    writeReceipt(inboxDir, receipt.name, receipt.body);
  }

  return collectPublicBetaFeedback({ inboxDir, outputPath });
}

function locked(collection: ReturnType<typeof collectPublicBetaFeedback>) {
  return (
    collection.releaseDecision === "do_not_release" &&
    collection.reviewOnly === true &&
    collection.accepted === false &&
    collection.packagingGated === true
  );
}

function hasTesterLaunchGate(collection: ReturnType<typeof collectPublicBetaFeedback>) {
  const gate = collection.testerLaunchGate;
  return (
    gate?.requiredImmediatelyBeforeContact === true &&
    gate.command === "npm run preflight:public-beta-tester -- --base-url http://127.0.0.1:3000" &&
    gate.evidencePath === "artifacts/productization/public-beta-tester-session-preflight.json" &&
    gate.stopIf.includes("Do not contact a tester")
  );
}

function main() {
  const checks: VerificationCheck[] = [];
  fs.rmSync(tempRoot, { recursive: true, force: true });

  const empty = runScenario("empty", []);
  push(
    checks,
    "Empty feedback inbox waits for feedback",
    empty.status === "waiting_for_feedback" &&
      empty.totalReceipts === 0 &&
      empty.validReceipts === 0 &&
      empty.invalidReceipts === 0 &&
      empty.nextAction.includes("Run the live tester preflight") &&
      hasTesterLaunchGate(empty) &&
      locked(empty),
    `status=${empty.status}; total=${empty.totalReceipts}; valid=${empty.validReceipts}; invalid=${empty.invalidReceipts}; launchGate=${empty.testerLaunchGate?.command}`
  );

  const ready = runScenario("ready", [{ name: "ready.json", body: baseReceipt("ready_for_next_beta_tester") }]);
  push(
    checks,
    "Ready feedback permits only the next bounded beta tester",
    ready.status === "ready_for_next_beta_tester" &&
      ready.validReceipts === 1 &&
      ready.decisionCounts.ready_for_next_beta_tester === 1 &&
      ready.nextAction.includes("Run the live tester preflight") &&
      ready.nextAction.includes("release and packaging remain locked") &&
      hasTesterLaunchGate(ready) &&
      locked(ready),
    `status=${ready.status}; ready=${ready.decisionCounts.ready_for_next_beta_tester}; nextAction=${ready.nextAction}; launchGate=${ready.testerLaunchGate?.command}`
  );

  const needsFix = runScenario("needs-fix", [
    { name: "needs-fix.json", body: baseReceipt("needs_fix_before_more_testers") }
  ]);
  push(
    checks,
    "Needs-fix feedback stops additional tester intake",
    needsFix.status === "needs_fix_before_more_testers" &&
      needsFix.validReceipts === 1 &&
      needsFix.decisionCounts.needs_fix_before_more_testers === 1 &&
      needsFix.nextAction.includes("Plan fixes") &&
      locked(needsFix),
    `status=${needsFix.status}; needsFix=${needsFix.decisionCounts.needs_fix_before_more_testers}; nextAction=${needsFix.nextAction}`
  );

  const blocked = runScenario("blocked", [{ name: "blocked.json", body: baseReceipt("blocked") }]);
  push(
    checks,
    "Blocked feedback preserves the blocker and blocks more testers",
    blocked.status === "blocked_by_beta_feedback" &&
      blocked.validReceipts === 1 &&
      blocked.decisionCounts.blocked === 1 &&
      blocked.receipts[0]?.blocker === "Tester found a blocking workflow issue." &&
      blocked.nextAction.includes("stop inviting more testers") &&
      locked(blocked),
    `status=${blocked.status}; blocked=${blocked.decisionCounts.blocked}; blocker=${blocked.receipts[0]?.blocker}`
  );

  const mixed = runScenario("mixed", [
    { name: "ready.json", body: baseReceipt("ready_for_next_beta_tester") },
    { name: "needs-fix.json", body: baseReceipt("needs_fix_before_more_testers") },
    { name: "blocked.json", body: baseReceipt("blocked") }
  ]);
  push(
    checks,
    "Blocked feedback takes priority over ready and needs-fix feedback",
    mixed.status === "blocked_by_beta_feedback" &&
      mixed.validReceipts === 3 &&
      mixed.decisionCounts.ready_for_next_beta_tester === 1 &&
      mixed.decisionCounts.needs_fix_before_more_testers === 1 &&
      mixed.decisionCounts.blocked === 1 &&
      locked(mixed),
    `status=${mixed.status}; counts=${JSON.stringify(mixed.decisionCounts)}`
  );

  const invalidReceipt = baseReceipt("ready_for_next_beta_tester");
  invalidReceipt.tester.name = "";
  invalidReceipt.locks.mustNotUnlockPackaging = false;
  const invalid = runScenario("invalid", [{ name: "invalid.json", body: invalidReceipt }]);
  push(
    checks,
    "Invalid feedback is not usable for follow-up planning",
    invalid.status === "has_invalid_feedback" &&
      invalid.validReceipts === 0 &&
      invalid.invalidReceipts === 1 &&
      invalid.receipts[0]?.failedChecks.includes("tester_identity") &&
      invalid.receipts[0]?.failedChecks.includes("locked_review_only_boundary") &&
      invalid.nextAction.includes("Fix invalid feedback receipts") &&
      locked(invalid),
    `status=${invalid.status}; failed=${invalid.receipts[0]?.failedChecks.join(",")}`
  );

  const invalidAndBlocked = runScenario("invalid-and-blocked", [
    { name: "invalid.json", body: invalidReceipt },
    { name: "blocked.json", body: baseReceipt("blocked") }
  ]);
  push(
    checks,
    "Invalid feedback takes priority over blocked feedback",
    invalidAndBlocked.status === "has_invalid_feedback" &&
      invalidAndBlocked.validReceipts === 1 &&
      invalidAndBlocked.invalidReceipts === 1 &&
      invalidAndBlocked.decisionCounts.blocked === 1 &&
      locked(invalidAndBlocked),
    `status=${invalidAndBlocked.status}; valid=${invalidAndBlocked.validReceipts}; invalid=${invalidAndBlocked.invalidReceipts}`
  );

  fs.rmSync(tempRoot, { recursive: true, force: true });

  const passed = checks.filter((check) => check.pass).length;
  const verification = {
    responseMode: "public_beta_feedback_collection_verification_json_v1",
    status: passed === checks.length ? "passed" : "failed",
    generatedAt: new Date().toISOString(),
    command: "npm run verify:public-beta-feedback-collection",
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
        ? "Feedback collection behavior is verified; use real inbox receipts for review-only beta follow-up planning."
        : "Fix feedback collection behavior before inviting or processing more beta testers."
  };

  fs.mkdirSync(artifactsDir, { recursive: true });
  fs.writeFileSync(receiptPath, JSON.stringify(verification, null, 2));
  console.log(JSON.stringify(verification, null, 2));
  console.log(`\nPublic beta feedback collection verification written to ${receiptPath}`);

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
