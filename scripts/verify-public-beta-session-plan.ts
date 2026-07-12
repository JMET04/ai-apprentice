import fs from "node:fs";
import path from "node:path";

type VerificationCheck = {
  name: string;
  pass: boolean;
  evidence: string;
};

const artifactsDir = path.join(process.cwd(), "artifacts", "productization");
const planJsonPath = path.join(artifactsDir, "public-beta-session-plan.json");
const planMarkdownPath = path.join(artifactsDir, "public-beta-session-plan.md");
const verificationPath = path.join(artifactsDir, "public-beta-session-plan-verification.json");

function readJson<T>(targetPath: string): T | null {
  try {
    return JSON.parse(fs.readFileSync(targetPath, "utf8")) as T;
  } catch {
    return null;
  }
}

function fileSize(targetPath: string) {
  return fs.existsSync(targetPath) ? fs.statSync(targetPath).size : 0;
}

function push(checks: VerificationCheck[], name: string, pass: boolean, evidence: string) {
  checks.push({ name, pass, evidence });
}

function main() {
  const checks: VerificationCheck[] = [];
  const plan = readJson<{
    responseMode?: string;
    status?: string;
    canStartSession?: boolean;
    failedReasons?: string[];
    releaseDecision?: string;
    reviewOnly?: boolean;
    accepted?: boolean;
    packagingGated?: boolean;
    sessionTimeboxMinutes?: number;
    launchPreflight?: { requiredImmediatelyBeforeContact?: boolean; command?: string; evidencePath?: string; stopIf?: string };
    testerEntryPoints?: Record<string, string>;
    dayOfChecklist?: Array<{
      phase?: string;
      owner?: string;
      action?: string;
      evidence?: string;
      stopCondition?: string;
    }>;
    sessionPhases?: Array<{
      id?: string;
      timeboxMinutes?: number;
      owner?: string;
      action?: string;
      evidence?: string;
      stopCondition?: string;
    }>;
    returnPipeline?: string[];
    receiptBindingRule?: string;
    stopConditions?: string[];
    expectedReturnedEvidence?: string[];
    sourceEvidence?: Record<string, string>;
    locks?: Record<string, boolean>;
  }>(planJsonPath);
  const markdown = fs.existsSync(planMarkdownPath) ? fs.readFileSync(planMarkdownPath, "utf8") : "";
  const phases = plan?.sessionPhases ?? [];
  const dayOfChecklist = plan?.dayOfChecklist ?? [];
  const returnPipeline = plan?.returnPipeline ?? [];
  const locks = plan?.locks ?? {};

  push(
    checks,
    "Session plan JSON is ready",
    plan?.responseMode === "public_beta_session_plan_json_v1" &&
      plan.status === "ready_for_session" &&
      plan.canStartSession === true &&
      (plan.failedReasons?.length ?? -1) === 0,
    `status=${plan?.status ?? "missing"}; canStart=${plan?.canStartSession ?? "missing"}; failed=${
      plan?.failedReasons?.join(",") || "none"
    }`
  );

  push(
    checks,
    "Session plan preserves productization locks",
    plan?.releaseDecision === "do_not_release" &&
      plan.reviewOnly === true &&
      plan.accepted === false &&
      plan.packagingGated === true &&
      locks.mustNotSaveAcceptance === true &&
      locks.mustNotEnableRules === true &&
      locks.mustNotUnlockPackaging === true &&
      locks.mustNotClaimReleaseReady === true &&
      locks.mustNotResumeAllSoftwareObjective === true &&
      locks.mustNotActivateRealModel === true,
    `release=${plan?.releaseDecision ?? "missing"}; accepted=${plan?.accepted ?? "missing"}; packagingGated=${
      plan?.packagingGated ?? "missing"
    }`
  );

  push(
    checks,
    "Session plan requires live preflight before tester contact",
    plan?.launchPreflight?.requiredImmediatelyBeforeContact === true &&
      plan.launchPreflight.command === "npm run preflight:public-beta-tester -- --base-url http://127.0.0.1:3000" &&
      plan.launchPreflight.evidencePath === "artifacts/productization/public-beta-tester-session-preflight.json" &&
      plan.launchPreflight.stopIf?.includes("Do not start") === true &&
      markdown.includes("Launch Preflight") &&
      markdown.includes(plan.launchPreflight.command),
    `command=${plan?.launchPreflight?.command ?? "missing"}; evidence=${plan?.launchPreflight?.evidencePath ?? "missing"}`
  );

  push(
    checks,
    "Session plan includes a day-of maintainer checklist",
    dayOfChecklist.length === 4 &&
      dayOfChecklist.some(
        (item) =>
          item.phase === "before_contact" &&
          item.action?.includes("tester preflight") &&
          item.stopCondition?.includes("do_not_release")
      ) &&
      dayOfChecklist.some(
        (item) =>
          item.phase === "during_session" &&
          item.action?.includes("human_review") &&
          item.stopCondition?.includes("/manual-test")
      ) &&
      dayOfChecklist.some(
        (item) =>
          item.phase === "after_session" &&
          item.action?.includes("return intake") &&
          item.stopCondition?.includes("Do not invite another tester")
      ) &&
      dayOfChecklist.some(
        (item) =>
          item.phase === "release_lock_audit" &&
          item.action?.includes("releaseDecision") &&
          item.stopCondition?.includes("accepted=true")
      ) &&
      markdown.includes("Day-Of Checklist") &&
      markdown.includes("release_lock_audit"),
    `items=${dayOfChecklist.map((item) => item.phase).join(",")}`
  );

  push(
    checks,
    "Session plan covers the full beta session flow",
    Number(plan?.sessionTimeboxMinutes ?? 0) >= 30 &&
      phases.length === 4 &&
      phases.some((phase) => phase.id === "pre_session_setup" && phase.owner === "maintainer") &&
      phases.some((phase) => phase.id === "core_teaching_loop" && phase.action?.includes("correction")) &&
      phases.some((phase) => phase.id === "human_review_evidence" && phase.evidence?.includes("human_review")) &&
      phases.some(
        (phase) =>
          phase.id === "feedback_receipt_return" &&
          phase.action?.includes("PUBLIC_BETA_SESSION_RECEIPT") &&
          phase.action?.includes("intake") &&
          phase.evidence?.includes("PUBLIC_BETA_SESSION_RECEIPT")
      ),
    `timebox=${plan?.sessionTimeboxMinutes ?? "missing"}; phases=${phases.map((phase) => phase.id).join(",")}`
  );

  push(
    checks,
    "Session plan routes returned feedback through validation and intake",
    returnPipeline.includes("npm run verify:public-beta-feedback -- --receipt path/to/submitted-feedback.json") &&
      returnPipeline.includes(
        "npm run verify:public-beta-session-receipt -- --receipt path/to/filled-public-beta-session-receipt.json"
      ) &&
      returnPipeline.includes("npm run intake:public-beta-return -- --receipt path/to/submitted-feedback.json --session-receipt path/to/filled-public-beta-session-receipt.json --send-receipt-validation artifacts/productization/first-real-tester-send-receipt-validation.json") &&
      returnPipeline.includes("npm run verify:public-beta-feedback-collection") &&
      returnPipeline.includes("npm run plan:public-beta-follow-up") &&
      returnPipeline.includes("npm run verify:public-beta-follow-up-plan") &&
      returnPipeline.includes("npm run verify:product-release-readiness -- --allow-blocked") &&
      markdown.includes("Return Pipeline"),
    `commands=${returnPipeline.length}`
  );

  push(
    checks,
    "Session plan makes receipt binding explicit",
    plan?.receiptBindingRule?.includes("same tester.name and tester.date") === true &&
      plan.receiptBindingRule.includes("intake rejects mismatches") &&
      plan.receiptBindingRule.includes("sessionEvidence.feedbackReceiptPath") &&
      dayOfChecklist.some((item) => item.phase === "after_session" && item.action?.includes("same tester.name/tester.date")) &&
      phases.some((phase) => phase.id === "feedback_receipt_return" && phase.action?.includes("same tester.name/tester.date")) &&
      plan.expectedReturnedEvidence?.some((item) => item.includes("same tester.name/tester.date")) === true &&
      markdown.includes("Receipt Binding Rule") &&
      markdown.includes("same tester.name and tester.date") &&
      markdown.includes("sessionEvidence.feedbackReceiptPath"),
    `binding=${plan?.receiptBindingRule ?? "missing"}`
  );

  push(
    checks,
    "Session plan names concrete tester evidence and stop conditions",
    plan?.expectedReturnedEvidence?.some((item) => item.includes("PUBLIC_BETA_FEEDBACK_RECEIPT")) === true &&
      plan.expectedReturnedEvidence.some((item) => item.includes("PUBLIC_BETA_SESSION_RECEIPT")) &&
      plan.expectedReturnedEvidence.some((item) => item.includes("human_review")) &&
      Number(plan.stopConditions?.length ?? 0) >= 5 &&
      plan.stopConditions?.some((item) => item.includes("production release")) === true &&
      plan.testerEntryPoints?.publicBeta === "http://127.0.0.1:3000/public-beta" &&
      plan.testerEntryPoints?.manualTest === "http://127.0.0.1:3000/manual-test" &&
      plan.testerEntryPoints?.sessionReceiptTemplate ===
        "artifacts/productization/public-beta-packet/docs/PUBLIC_BETA_SESSION_RECEIPT.template.json",
    `expectedEvidence=${plan?.expectedReturnedEvidence?.length ?? 0}; stops=${plan?.stopConditions?.length ?? 0}`
  );

  push(
    checks,
    "Session plan is backed by green or bootstrap-allowed source evidence",
    (plan?.sourceEvidence?.publicBetaReadiness?.includes("passed") === true ||
      plan?.sourceEvidence?.publicBetaReadiness?.includes("packet=ready_for_public_beta") === true) &&
      plan.sourceEvidence.testerInvite?.includes("ready_to_invite") === true &&
      plan.sourceEvidence.feedbackCollectionVerification?.includes("passed") === true &&
      plan.sourceEvidence.returnIntakeVerification?.includes("passed") === true &&
      (plan.sourceEvidence.productizationEvidenceFreshness?.includes("passed") === true ||
        plan.sourceEvidence.productizationEvidenceFreshness?.includes("bootstrapAllowed=true") === true) &&
      plan.sourceEvidence.releaseReadiness?.includes("blocked_not_release_ready") === true,
    `readiness=${plan?.sourceEvidence?.publicBetaReadiness ?? "missing"}; invite=${
      plan?.sourceEvidence?.testerInvite ?? "missing"
    }; release=${plan?.sourceEvidence?.releaseReadiness ?? "missing"}`
  );

  push(
    checks,
    "Session plan Markdown is readable and explicit",
    fileSize(planMarkdownPath) > 2000 &&
      markdown.includes("Facilitator Flow") &&
      markdown.includes("Stop Conditions") &&
      markdown.includes("do_not_release") &&
      markdown.includes("does not unlock packaging"),
    `markdownBytes=${fileSize(planMarkdownPath)}`
  );

  const passed = checks.filter((check) => check.pass).length;
  const verification = {
    responseMode: "public_beta_session_plan_verification_json_v1",
    status: passed === checks.length ? "passed" : "failed",
    generatedAt: new Date().toISOString(),
    command: "npm run verify:public-beta-session-plan",
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
        ? "Use public-beta-session-plan.md to host one bounded beta tester session, then process the returned receipt through intake."
        : "Fix the public beta session plan before scheduling a tester."
  };

  fs.mkdirSync(artifactsDir, { recursive: true });
  fs.writeFileSync(verificationPath, JSON.stringify(verification, null, 2));
  console.log(JSON.stringify(verification, null, 2));
  console.log(`\nPublic beta session plan verification written to ${verificationPath}`);

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




