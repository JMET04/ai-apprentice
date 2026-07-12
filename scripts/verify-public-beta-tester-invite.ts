import fs from "node:fs";
import path from "node:path";

type VerificationCheck = {
  name: string;
  pass: boolean;
  evidence: string;
};

const artifactsDir = path.join(process.cwd(), "artifacts", "productization");
const inviteJsonPath = path.join(artifactsDir, "public-beta-tester-invite.json");
const inviteMarkdownPath = path.join(artifactsDir, "public-beta-tester-invite.md");
const receiptPath = path.join(artifactsDir, "public-beta-tester-invite-verification.json");

function push(checks: VerificationCheck[], name: string, pass: boolean, evidence: string) {
  checks.push({ name, pass, evidence });
}

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

function main() {
  const checks: VerificationCheck[] = [];
  const invite = readJson<{
    responseMode?: string;
    status?: string;
    canInvite?: boolean;
    failedReasons?: string[];
    releaseDecision?: string;
    reviewOnly?: boolean;
    accepted?: boolean;
    packagingGated?: boolean;
    inviteMessage?: string;
    maintainerChecklist?: string[];
    testerChecklist?: string[];
    expectedReturnedEvidence?: string[];
    testerEntryPoints?: Record<string, string>;
    launchPreflight?: {
      requiredImmediatelyBeforeContact?: boolean;
      command?: string;
      evidencePath?: string;
      mustBeGeneratedAfterInvite?: boolean;
      mustBeGeneratedAfterProductizationFreshness?: boolean;
      stopIf?: string;
    };
    sourceEvidence?: {
      publicBetaReadiness?: { status?: string; betaCanStart?: boolean; passed?: number; total?: number };
      productizationEvidenceFreshness?: { status?: string; passed?: number; total?: number; releaseDecision?: string };
      publicBetaPreparation?: { status?: string; passed?: number; total?: number };
      publicBetaFeedbackCollection?: {
        status?: string;
        generatedAt?: string;
        totalReceipts?: number;
        validReceipts?: number;
        invalidReceipts?: number;
        launchGate?: boolean;
        verificationStatus?: string;
        verificationPassed?: number;
        verificationTotal?: number;
      };
      publicBetaFollowUpPlan?: {
        status?: string;
        expectedStatus?: string;
        generatedAt?: string;
        sourceCollectionPath?: string;
        currentForFeedbackCollection?: boolean;
        launchGate?: boolean;
        canInviteNextTester?: boolean;
        actionCount?: number;
      };
      publicBetaPacket?: {
        status?: string;
        betaCanStart?: boolean;
        requiredPassed?: number;
        requiredTotal?: number;
        deferredOnlyForInvite?: boolean;
      };
      publicBetaSessionReceipt?: {
        status?: string;
        mode?: string;
        passed?: number;
        total?: number;
        releaseDecision?: string;
        reviewOnly?: boolean;
        accepted?: boolean;
        packagingGated?: boolean;
        canRelease?: boolean;
      };
      liveHandoff?: { status?: string; passed?: number; total?: number };
      releaseReadiness?: { status?: string; releaseDecision?: string };
    };
    locks?: {
      mustNotSaveAcceptance?: boolean;
      mustNotEnableRules?: boolean;
      mustNotUnlockPackaging?: boolean;
      mustNotClaimReleaseReady?: boolean;
      mustNotResumeAllSoftwareObjective?: boolean;
    };
  }>(inviteJsonPath);
  const markdown = fs.existsSync(inviteMarkdownPath) ? fs.readFileSync(inviteMarkdownPath, "utf8") : "";
  const preparationEvidence = invite?.sourceEvidence?.publicBetaPreparation;
  const testerChecklist = invite?.testerChecklist ?? [];
  const maintainerChecklist = invite?.maintainerChecklist ?? [];
  const expectedReturnedEvidence = invite?.expectedReturnedEvidence ?? [];
  const testerEntryPoints = invite?.testerEntryPoints ?? {};
  const launchPreflight = invite?.launchPreflight;

  push(
    checks,
    "Tester invite JSON is ready",
    invite?.responseMode === "public_beta_tester_invite_json_v1" &&
      invite.status === "ready_to_invite" &&
      invite.canInvite === true &&
      (invite.failedReasons?.length ?? -1) === 0,
    `status=${invite?.status ?? "missing"}; canInvite=${invite?.canInvite ?? "missing"}; failed=${
      invite?.failedReasons?.join(",") || "none"
    }`
  );

  push(
    checks,
    "Tester invite preserves release and packaging locks",
    invite?.releaseDecision === "do_not_release" &&
      invite.reviewOnly === true &&
      invite.accepted === false &&
      invite.packagingGated === true &&
      invite.locks?.mustNotSaveAcceptance === true &&
      invite.locks.mustNotEnableRules === true &&
      invite.locks.mustNotUnlockPackaging === true &&
      invite.locks.mustNotClaimReleaseReady === true &&
      invite.locks.mustNotResumeAllSoftwareObjective === true,
    `release=${invite?.releaseDecision ?? "missing"}; accepted=${invite?.accepted ?? "missing"}; packagingGated=${
      invite?.packagingGated ?? "missing"
    }`
  );

  push(
    checks,
    "Tester invite is backed by current beta readiness evidence",
    ((invite?.sourceEvidence?.publicBetaReadiness?.status === "passed" &&
      invite.sourceEvidence.publicBetaReadiness.betaCanStart === true) ||
      (invite?.sourceEvidence?.publicBetaPacket?.status === "ready_for_public_beta" &&
        invite.sourceEvidence.publicBetaPacket.betaCanStart === true)) &&
      ["passed", "running"].includes(preparationEvidence?.status ?? "") &&
      preparationEvidence?.passed === preparationEvidence?.total &&
      ["waiting_for_feedback", "ready_for_next_beta_tester"].includes(
        invite.sourceEvidence.publicBetaFeedbackCollection?.status ?? ""
      ) &&
      invite.sourceEvidence.publicBetaFeedbackCollection?.launchGate === true &&
      invite.sourceEvidence.publicBetaFeedbackCollection?.verificationStatus === "passed" &&
      invite.sourceEvidence.publicBetaFeedbackCollection.verificationPassed ===
        invite.sourceEvidence.publicBetaFeedbackCollection.verificationTotal &&
      invite.sourceEvidence.publicBetaFollowUpPlan?.status ===
        invite.sourceEvidence.publicBetaFollowUpPlan?.expectedStatus &&
      invite.sourceEvidence.publicBetaFollowUpPlan?.sourceCollectionPath ===
        "artifacts/productization/public-beta-feedback-collection.json" &&
      invite.sourceEvidence.publicBetaFollowUpPlan?.currentForFeedbackCollection === true &&
      invite.sourceEvidence.publicBetaFollowUpPlan?.launchGate === true &&
      invite.sourceEvidence.publicBetaFollowUpPlan?.canInviteNextTester === true &&
      (invite.sourceEvidence.publicBetaPacket?.status === "ready_for_public_beta" ||
        invite.sourceEvidence.publicBetaPacket?.deferredOnlyForInvite === true) &&
      invite.sourceEvidence.liveHandoff?.status === "passed" &&
      invite.sourceEvidence.releaseReadiness?.releaseDecision === "do_not_release",
    `readiness=${invite?.sourceEvidence?.publicBetaReadiness?.status ?? "missing"}; freshness=${
      invite?.sourceEvidence?.productizationEvidenceFreshness?.status ?? "missing"
    } ${invite?.sourceEvidence?.productizationEvidenceFreshness?.passed ?? "?"}/${
      invite?.sourceEvidence?.productizationEvidenceFreshness?.total ?? "?"
    }; prep=${
      invite?.sourceEvidence?.publicBetaPreparation?.passed ?? "?"
    }/${invite?.sourceEvidence?.publicBetaPreparation?.total ?? "?"}; feedback=${
      invite?.sourceEvidence?.publicBetaFeedbackCollection?.status ?? "missing"
    }/${invite?.sourceEvidence?.publicBetaFeedbackCollection?.verificationStatus ?? "missing"}; followUp=${
      invite?.sourceEvidence?.publicBetaFollowUpPlan?.status ?? "missing"
    }->${invite?.sourceEvidence?.publicBetaFollowUpPlan?.expectedStatus ?? "missing"}; current=${
      invite?.sourceEvidence?.publicBetaFollowUpPlan?.currentForFeedbackCollection ?? "missing"
    }`
  );

  push(
    checks,
    "Tester invite has actionable tester and maintainer instructions",
    (invite?.inviteMessage?.includes("bounded beta test") ?? false) &&
      (invite?.inviteMessage?.includes("return the public beta feedback receipt plus any notes or screenshots") ?? false) &&
      (invite?.inviteMessage?.includes("facilitator/maintainer will complete the whole-session receipt") ?? false) &&
      testerChecklist.length >= 6 &&
      testerChecklist.some((item) => item.includes("/public-beta")) &&
      testerChecklist.some((item) => item.includes("PUBLIC_BETA_FEEDBACK_RECEIPT.template.json")) &&
      testerChecklist.some((item) => item.includes("facilitator/maintainer fills docs/PUBLIC_BETA_SESSION_RECEIPT.template.json")) &&
      !testerChecklist.some((item) => item.includes("return both JSON receipts")) &&
      maintainerChecklist.length >= 6 &&
      maintainerChecklist.some((item) => item.includes("productization-evidence-freshness")) &&
      maintainerChecklist.some((item) => item.includes("Send the tester") && item.includes("PUBLIC_BETA_FEEDBACK_RECEIPT.template.json") && item.includes("keep docs/PUBLIC_BETA_SESSION_RECEIPT.template.json with the facilitator/maintainer")) &&
      testerEntryPoints.publicBeta === "http://127.0.0.1:3000/public-beta" &&
      testerEntryPoints.startHere === "artifacts/productization/public-beta-packet/START_PUBLIC_BETA.md" &&
      testerEntryPoints.feedbackReceiptTemplate?.includes("PUBLIC_BETA_FEEDBACK_RECEIPT.template.json") ===
        true &&
      testerEntryPoints.facilitatorSessionReceiptTemplate ===
        "artifacts/productization/public-beta-packet/docs/PUBLIC_BETA_SESSION_RECEIPT.template.json",
    `testerSteps=${testerChecklist.length}; maintainerSteps=${maintainerChecklist.length}; startHere=${
      testerEntryPoints.startHere ?? "missing"
    }`
  );
  push(
    checks,
    "Tester invite requires immediate live preflight before contact",
    launchPreflight?.requiredImmediatelyBeforeContact === true &&
      launchPreflight.command === "npm run preflight:public-beta-tester -- --base-url http://127.0.0.1:3000" &&
      launchPreflight.evidencePath === "artifacts/productization/public-beta-tester-session-preflight.json" &&
      launchPreflight.mustBeGeneratedAfterInvite === true &&
      launchPreflight.mustBeGeneratedAfterProductizationFreshness === true &&
      launchPreflight.stopIf?.includes("Do not contact tester") === true &&
      maintainerChecklist.some((item) => item.includes(launchPreflight.command ?? "missing")) &&
      markdown.includes("Launch Preflight") &&
      markdown.includes(launchPreflight.evidencePath ?? "missing"),
    `command=${launchPreflight?.command ?? "missing"}; evidence=${launchPreflight?.evidencePath ?? "missing"}; required=${
      launchPreflight?.requiredImmediatelyBeforeContact ?? "missing"
    }`
  );
  push(
    checks,
    "Tester invite routes returned receipts through intake",
    maintainerChecklist.some((item) => item.includes("npm run verify:public-beta-feedback -- --receipt <path>")) &&
      maintainerChecklist.some((item) => item.includes("npm run verify:public-beta-session-receipt -- --receipt <path>")) &&
      maintainerChecklist.some((item) => item.includes("npm run intake:public-beta-return -- --receipt <path> --session-receipt <session-receipt-path> --send-receipt-validation artifacts/productization/first-real-tester-send-receipt-validation.json")) &&
      maintainerChecklist.some((item) => item.includes("verify:public-beta-feedback-collection")) &&
      maintainerChecklist.some((item) => item.includes("verify:public-beta-follow-up-plan")) &&
      !maintainerChecklist.some((item) => item.includes("Place valid returned receipts")) &&
      markdown.includes("npm run intake:public-beta-return -- --receipt <path> --session-receipt <session-receipt-path> --send-receipt-validation artifacts/productization/first-real-tester-send-receipt-validation.json") &&
      markdown.includes("npm run verify:public-beta-session-receipt -- --receipt <path>") &&
      !markdown.includes("Place valid returned receipts"),
    `verify=${maintainerChecklist.some((item) => item.includes("npm run verify:public-beta-feedback -- --receipt <path>"))}; intake=${maintainerChecklist.some(
      (item) => item.includes("npm run intake:public-beta-return -- --receipt <path> --session-receipt <session-receipt-path> --send-receipt-validation artifacts/productization/first-real-tester-send-receipt-validation.json")
    )}; manualInbox=${maintainerChecklist.some((item) => item.includes("Place valid returned receipts"))}`
  );

  push(
    checks,
    "Tester invite keeps whole-session receipt with facilitator",
    invite?.sourceEvidence?.publicBetaSessionReceipt?.status === "template_ready" &&
      invite.sourceEvidence.publicBetaSessionReceipt.mode === "template" &&
      invite.sourceEvidence.publicBetaSessionReceipt.passed === invite.sourceEvidence.publicBetaSessionReceipt.total &&
      Number(invite.sourceEvidence.publicBetaSessionReceipt.total ?? 0) >= 9 &&
      invite.sourceEvidence.publicBetaSessionReceipt.releaseDecision === "do_not_release" &&
      invite.sourceEvidence.publicBetaSessionReceipt.reviewOnly === true &&
      invite.sourceEvidence.publicBetaSessionReceipt.accepted === false &&
      invite.sourceEvidence.publicBetaSessionReceipt.packagingGated === true &&
      invite.sourceEvidence.publicBetaSessionReceipt.canRelease === false &&
      maintainerChecklist.some((item) => item.includes("PUBLIC_BETA_SESSION_RECEIPT.template.json")) &&
      maintainerChecklist.some((item) => item.includes("npm run verify:public-beta-session-receipt -- --receipt <path>")) &&
      expectedReturnedEvidence.some((item) => item.includes("PUBLIC_BETA_SESSION_RECEIPT")) &&
      testerEntryPoints.facilitatorSessionReceiptTemplate ===
        "artifacts/productization/public-beta-packet/docs/PUBLIC_BETA_SESSION_RECEIPT.template.json" &&
      markdown.includes("facilitator/maintainer fills docs/PUBLIC_BETA_SESSION_RECEIPT.template.json") &&
      !markdown.includes("return both JSON receipts"),
    `sessionReceipt=${invite?.sourceEvidence?.publicBetaSessionReceipt?.status ?? "missing"} ${
      invite?.sourceEvidence?.publicBetaSessionReceipt?.passed ?? "?"
    }/${invite?.sourceEvidence?.publicBetaSessionReceipt?.total ?? "?"}; entry=${
      testerEntryPoints.facilitatorSessionReceiptTemplate ?? "missing"
    }`
  );

  push(
    checks,
    "Tester invite requests real returned evidence",
    expectedReturnedEvidence.some((item) => item.includes("human_review")) &&
      expectedReturnedEvidence.some((item) => item.includes("PUBLIC_BETA_FEEDBACK_RECEIPT")) &&
      expectedReturnedEvidence.some((item) => item.includes("PUBLIC_BETA_SESSION_RECEIPT")) &&
      markdown.includes("/manual-test") &&
      markdown.includes("do_not_release") &&
      fileSize(inviteMarkdownPath) > 500,
    `markdownBytes=${fileSize(inviteMarkdownPath)}; expectedEvidence=${expectedReturnedEvidence.length}`
  );

  const passed = checks.filter((check) => check.pass).length;
  const verification = {
    responseMode: "public_beta_tester_invite_verification_json_v1",
    status: passed === checks.length ? "passed" : "failed",
    generatedAt: new Date().toISOString(),
    command: "npm run verify:public-beta-tester-invite",
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
        ? "Run the live public beta tester preflight, then send public-beta-tester-invite.md to one bounded beta tester; validate returned evidence before inviting another tester."
        : "Fix the tester invite kit before inviting beta testers."
  };

  fs.mkdirSync(artifactsDir, { recursive: true });
  fs.writeFileSync(receiptPath, JSON.stringify(verification, null, 2));
  console.log(JSON.stringify(verification, null, 2));
  console.log(`\nPublic beta tester invite verification written to ${receiptPath}`);

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
