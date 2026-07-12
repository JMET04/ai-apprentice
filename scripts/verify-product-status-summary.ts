import fs from "node:fs";
import path from "node:path";

type StatusSummaryCheck = {
  name: string;
  pass: boolean;
  evidence: string;
};

const artifactsDir = path.join(process.cwd(), "artifacts", "productization");
const summaryPath = path.join(artifactsDir, "product-status-summary.json");
const markdownPath = path.join(artifactsDir, "product-status-summary.md");
const receiptPath = path.join(artifactsDir, "product-status-summary-verification.json");

function push(checks: StatusSummaryCheck[], name: string, pass: boolean, evidence: string) {
  checks.push({ name, pass, evidence });
}

function fileExistsWithSize(relativePath: string, minimumBytes = 1) {
  const fullPath = path.join(process.cwd(), relativePath);
  return fs.existsSync(fullPath) && fs.statSync(fullPath).size >= minimumBytes;
}

function readJson<T>(relativePath: string): T | null {
  const fullPath = path.join(process.cwd(), relativePath);
  if (!fs.existsSync(fullPath)) return null;
  return JSON.parse(fs.readFileSync(fullPath, "utf8")) as T;
}

function main() {
  const checks: StatusSummaryCheck[] = [];
  const summary = readJson<{
    responseMode?: string;
    status?: string;
    productScope?: string;
    allSoftwareObjective?: string;
    releaseDecision?: string;
    betaCanStart?: boolean;
    canRelease?: boolean;
    canActivateRealModel?: boolean;
    reviewOnly?: boolean;
    accepted?: boolean;
    packagingGated?: boolean;
    hardLocksPreserved?: boolean;
    readiness?: Record<string, string>;
    sourceEvidence?: Record<string, string>;
    releaseBlockers?: Array<{ name?: string; evidence?: string; nextAction?: string }>;
    nextBestActions?: Array<{
      id?: string;
      allowed?: boolean;
      command?: string;
      evidencePath?: string;
      testerRunbookPath?: string;
      sessionPlanPath?: string;
      sessionReceiptTemplatePath?: string;
      reviewerKitPath?: string;
      stopCondition?: string;
    }>;
    blockedActions?: string[];
    failedReasons?: string[];
  }>("artifacts/productization/product-status-summary.json");
  const markdown = fs.existsSync(markdownPath) ? fs.readFileSync(markdownPath, "utf8") : "";
  const packageJson = readJson<{ scripts?: Record<string, string> }>("package.json");

  push(
    checks,
    "Status summary exists as the one-page status companion",
    summary?.responseMode === "product_status_summary_json_v1" &&
      summary.status === "ready_for_bounded_beta_not_release" &&
      fileExistsWithSize("artifacts/productization/product-status-summary.json", 100) &&
      fileExistsWithSize("artifacts/productization/product-status-summary.md", 1000),
    `status=${summary?.status ?? "missing"}; markdown=${markdown.length}`
  );

  push(
    checks,
    "Summary preserves release and packaging locks",
    summary?.productScope === "bounded_core_teaching_loop" &&
      summary.allSoftwareObjective === "paused" &&
      summary.releaseDecision === "do_not_release" &&
      summary.reviewOnly === true &&
      summary.accepted === false &&
      summary.packagingGated === true &&
      summary.canRelease === false &&
      summary.canActivateRealModel === false &&
      summary.hardLocksPreserved === true,
    `scope=${summary?.productScope ?? "missing"}; release=${summary?.releaseDecision ?? "missing"}; accepted=${
      summary?.accepted ?? "missing"
    }; packagingGated=${summary?.packagingGated ?? "missing"}; canRelease=${summary?.canRelease ?? "missing"}; canActivateRealModel=${
      summary?.canActivateRealModel ?? "missing"
    }; hardLocks=${summary?.hardLocksPreserved ?? "missing"}`
  );

  push(
    checks,
    "Summary says beta can start but release cannot",
    summary?.betaCanStart === true &&
      summary.readiness?.publicBeta?.includes("betaCanStart=true") === true &&
      summary.readiness?.testerRunbook?.includes("ready=true") === true &&
      summary.readiness.testerRunbook.includes("PUBLIC_BETA_TESTER_RUNBOOK.md") &&
      summary.readiness?.publicBetaSessionPlan?.includes("ready=true") === true &&
      summary.readiness.publicBetaSessionPlan.includes("PUBLIC_BETA_SESSION_PLAN.md") &&
      /verifier=passed ([1-9][0-9]*)\/\1/.test(summary.readiness.publicBetaSessionPlan) &&
      summary.readiness?.publicBetaSessionReceipt?.includes("ready=true") === true &&
      summary.readiness.publicBetaSessionReceipt.includes("PUBLIC_BETA_SESSION_RECEIPT.template.json") &&
      summary.readiness.publicBetaSessionReceipt.includes("verifier=template_ready 9/9") &&
      summary.readiness.publicBetaSessionReceipt.includes("mode=template") &&
      summary.readiness?.release?.includes("blocked_not_release_ready") === true &&
      summary.readiness.release.includes("decision=do_not_release") &&
      summary.readiness?.handoff?.startsWith("passed") === true &&
      summary.readiness?.publicBetaFeedbackCollection?.includes("verifier=passed") === true &&
      summary.readiness?.publicBetaFollowUpPlan?.includes("verifier=passed") === true &&
      summary.readiness?.humanAcceptanceReviewerInvite?.includes("ready_to_invite_reviewer") === true &&
      summary.readiness.humanAcceptanceReviewerInvite.includes("verifier=passed 7/7"),
    `beta=${summary?.betaCanStart ?? "missing"}; publicBeta=${summary?.readiness?.publicBeta ?? "missing"}; release=${
      summary?.readiness?.release ?? "missing"
    }; handoff=${summary?.readiness?.handoff ?? "missing"}`
  );

  push(
    checks,
    "Summary carries the known release blockers",
    Number(summary?.releaseBlockers?.length ?? 0) >= 3 &&
      summary?.releaseBlockers?.some((blocker) => blocker.name === "Real human acceptance is complete") === true &&
      summary.releaseBlockers.some((blocker) => blocker.name === "Real model adapter is ready") &&
      summary.releaseBlockers.some((blocker) => blocker.name === "Packaging and release lock is intentionally still closed") &&
      summary.blockedActions?.includes("claim_real_human_acceptance_from_automation") === true,
    `blockers=${summary?.releaseBlockers?.map((blocker) => blocker.name).join(",") ?? "missing"}; blocked=${
      summary?.blockedActions?.join(",") ?? "missing"
    }`
  );

  push(
    checks,
    "Summary exposes the three maintainer next actions",
    summary?.nextBestActions?.some(
      (action) =>
        action.id === "invite_one_bounded_beta_tester" &&
        action.allowed === true &&
        action.command === "npm run preflight:public-beta-tester -- --base-url http://127.0.0.1:3000" &&
        action.evidencePath === "artifacts/productization/public-beta-packet/START_PUBLIC_BETA.md" &&
        action.testerRunbookPath === "artifacts/productization/public-beta-packet/docs/PUBLIC_BETA_TESTER_RUNBOOK.md" &&
        action.sessionPlanPath === "artifacts/productization/public-beta-packet/docs/PUBLIC_BETA_SESSION_PLAN.md" &&
        action.sessionReceiptTemplatePath ===
          "artifacts/productization/public-beta-packet/docs/PUBLIC_BETA_SESSION_RECEIPT.template.json" &&
        action.stopCondition?.includes("betaCanStart") === true &&
        action.stopCondition?.includes("releaseDecision is not do_not_release") === true
    ) === true &&
      summary.nextBestActions.some(
        (action) =>
          action.id === "collect_real_human_acceptance" &&
          action.allowed === true &&
          action.evidencePath === "artifacts/productization/human-acceptance-reviewer-invite.md" &&
          action.reviewerKitPath === "artifacts/productization/human-acceptance-reviewer-kit.md" &&
          action.stopCondition?.includes("automated_browser_smoke") === true &&
          action.stopCondition?.includes("reviewer cannot attest") === true
      ) &&
      summary.nextBestActions.some(
        (action) =>
          action.id === "process_public_beta_feedback_return" &&
          action.allowed === true &&
          action.command === "npm run intake:public-beta-return -- --receipt path/to/submitted-feedback.json --session-receipt path/to/filled-public-beta-session-receipt.json --send-receipt-validation artifacts/productization/first-real-tester-send-receipt-validation.json" &&
          action.evidencePath === "artifacts/productization/public-beta-follow-up-plan.json" &&
          action.stopCondition?.includes("tester.name/tester.date") === true &&
          action.stopCondition?.includes("sessionEvidence.feedbackReceiptPath") === true
      ) &&
      summary.nextBestActions.some(
        (action) =>
          action.id === "plan_real_model_trial_without_activation" &&
          action.allowed === true &&
          action.stopCondition?.includes("credentials would enter source control") === true &&
          action.stopCondition?.includes("canActivateRealModel becomes true") === true
      ),
    `actions=${summary?.nextBestActions?.map((action) => `${action.id}:${action.allowed}`).join(",") ?? "missing"}`
  );

  push(
    checks,
    "Summary links to source evidence and keeps mock-provider boundary visible",
    summary?.sourceEvidence?.publicBetaReadiness === "artifacts/productization/public-beta-readiness.json" &&
      summary.sourceEvidence.publicBetaPacketOverview === "artifacts/productization/public-beta-packet/START_PUBLIC_BETA.md" &&
      summary.sourceEvidence.publicBetaTesterRunbook ===
        "artifacts/productization/public-beta-packet/docs/PUBLIC_BETA_TESTER_RUNBOOK.md" &&
      fileExistsWithSize("artifacts/productization/public-beta-packet/docs/PUBLIC_BETA_TESTER_RUNBOOK.md", 1000) &&
      summary.sourceEvidence.publicBetaSessionPlan ===
        "artifacts/productization/public-beta-packet/docs/PUBLIC_BETA_SESSION_PLAN.md" &&
      summary.sourceEvidence.publicBetaSessionPlanVerification ===
        "artifacts/productization/public-beta-session-plan-verification.json" &&
      fileExistsWithSize("artifacts/productization/public-beta-packet/docs/PUBLIC_BETA_SESSION_PLAN.md", 1000) &&
      fileExistsWithSize("artifacts/productization/public-beta-session-plan-verification.json", 100) &&
      summary.sourceEvidence.publicBetaSessionReceiptTemplate ===
        "artifacts/productization/public-beta-packet/docs/PUBLIC_BETA_SESSION_RECEIPT.template.json" &&
      summary.sourceEvidence.publicBetaSessionReceiptValidation ===
        "artifacts/productization/public-beta-session-receipt-validation.json" &&
      fileExistsWithSize("artifacts/productization/public-beta-packet/docs/PUBLIC_BETA_SESSION_RECEIPT.template.json", 1000) &&
      fileExistsWithSize("artifacts/productization/public-beta-session-receipt-validation.json", 100) &&
      summary.sourceEvidence.productReleaseReadiness === "artifacts/productization/product-release-readiness.json" &&
      summary.sourceEvidence.productOperatorBrief === "artifacts/productization/product-operator-brief.json" &&
      summary.sourceEvidence.productReleaseBlockerBoard === "artifacts/productization/product-release-blocker-board.json" &&
      summary.sourceEvidence.publicBetaFeedbackCollection ===
        "artifacts/productization/public-beta-feedback-collection.json" &&
      summary.sourceEvidence.publicBetaFeedbackCollectionVerification ===
        "artifacts/productization/public-beta-feedback-collection-verification.json" &&
      summary.sourceEvidence.publicBetaFollowUpPlan === "artifacts/productization/public-beta-follow-up-plan.json" &&
      summary.sourceEvidence.publicBetaFollowUpPlanVerification ===
        "artifacts/productization/public-beta-follow-up-plan-verification.json" &&
      fileExistsWithSize("artifacts/productization/public-beta-feedback-collection-verification.json", 100) &&
      fileExistsWithSize("artifacts/productization/public-beta-follow-up-plan.json", 100) &&
      fileExistsWithSize("artifacts/productization/public-beta-follow-up-plan-verification.json", 100) &&
      summary.sourceEvidence.humanAcceptanceGate === "artifacts/productization/human-acceptance-gate.json" &&
      summary.sourceEvidence.humanAcceptanceReviewerInvite === "artifacts/productization/human-acceptance-reviewer-invite.json" &&
      summary.sourceEvidence.humanAcceptanceReviewerInviteVerification ===
        "artifacts/productization/human-acceptance-reviewer-invite-verification.json" &&
      summary.sourceEvidence.humanAcceptanceReviewerInviteMarkdown ===
        "artifacts/productization/human-acceptance-reviewer-invite.md" &&
      fileExistsWithSize("artifacts/productization/human-acceptance-reviewer-invite.md", 1000) &&
      summary.sourceEvidence.realModelAdapterContract ===
        "artifacts/productization/real-model-adapter-contract-verification.json" &&
      summary.readiness?.humanAcceptance?.includes("evidence=automated_browser_smoke") === true &&
      summary.readiness?.realModel?.includes("activeProvider=mock") === true &&
      summary.readiness.realModel.includes("realModelReady=false"),
    `human=${summary?.readiness?.humanAcceptance ?? "missing"}; realModel=${summary?.readiness?.realModel ?? "missing"}`
  );

  push(
    checks,
    "Package scripts expose status summary and beta follow-up commands",
    packageJson?.scripts?.["build:product-status-summary"] === "tsx scripts/build-product-status-summary.ts" &&
      packageJson.scripts?.["verify:product-status-summary"] === "tsx scripts/verify-product-status-summary.ts" &&
      packageJson.scripts?.["collect:public-beta-feedback"] === "tsx scripts/collect-public-beta-feedback.ts" &&
      packageJson.scripts?.["verify:public-beta-feedback-collection"] ===
        "tsx scripts/verify-public-beta-feedback-collection.ts" &&
      packageJson.scripts?.["plan:public-beta-follow-up"] === "tsx scripts/plan-public-beta-follow-up.ts" &&
      packageJson.scripts?.["verify:public-beta-follow-up-plan"] ===
        "tsx scripts/verify-public-beta-follow-up-plan.ts",
    `build=${packageJson?.scripts?.["build:product-status-summary"] ?? "missing"}; verify=${
      packageJson?.scripts?.["verify:product-status-summary"] ?? "missing"
    }; collect=${packageJson?.scripts?.["collect:public-beta-feedback"] ?? "missing"}; followUp=${
      packageJson?.scripts?.["plan:public-beta-follow-up"] ?? "missing"
    }`
  );

  push(
    checks,
    "Markdown summary is readable and does not claim release readiness",
    markdown.includes("Product Status Summary") &&
      markdown.includes("Can one bounded beta start?") &&
      markdown.includes("Can this be released?") &&
      markdown.includes("Can a real model be activated?") &&
      markdown.includes("Release Blockers") &&
      markdown.includes("process_public_beta_feedback_return") &&
      markdown.includes("sessionEvidence.feedbackReceiptPath") &&
      markdown.includes("betaCanStart is false") &&
      markdown.includes("automated_browser_smoke") &&
      markdown.includes("credentials would enter source control") &&
      markdown.includes("humanAcceptanceReviewerInvite") &&
      markdown.includes("human-acceptance-reviewer-invite.md") &&
      markdown.includes("publicBetaFollowUpPlan") &&
      markdown.includes("publicBetaSessionPlan") &&
      markdown.includes("PUBLIC_BETA_SESSION_PLAN.md") &&
      markdown.includes("publicBetaSessionReceipt") &&
      markdown.includes("PUBLIC_BETA_SESSION_RECEIPT.template.json") &&
      markdown.includes("Blocked Actions") &&
      markdown.includes("This summary is review-only") &&
      markdown.includes("`canRelease=false`") &&
      markdown.includes("`canActivateRealModel=false`") &&
      !markdown.includes("release_candidate") &&
      !markdown.includes("accepted=true") &&
      !markdown.includes("packagingGated=false"),
    `bytes=${markdown.length}`
  );

  const passed = checks.filter((check) => check.pass).length;
  const receipt = {
    responseMode: "product_status_summary_verification_json_v1",
    status: passed === checks.length ? "passed" : "failed",
    generatedAt: new Date().toISOString(),
    command: "npm run verify:product-status-summary",
    productScope: "bounded_core_teaching_loop",
    allSoftwareObjective: "paused",
    releaseDecision: "do_not_release",
    reviewOnly: true,
    accepted: false,
    packagingGated: true,
    canRelease: false,
    canActivateRealModel: false,
    passed,
    total: checks.length,
    checks,
    nextAction:
      passed === checks.length
        ? "Use artifacts/productization/product-status-summary.md after the takeover matrix to inspect beta-ready, release-blocked, mock-provider, and all-software-paused status."
        : "Fix the failed status summary checks, then rebuild and verify it."
  };

  fs.mkdirSync(artifactsDir, { recursive: true });
  fs.writeFileSync(receiptPath, JSON.stringify(receipt, null, 2));
  console.log(JSON.stringify(receipt, null, 2));
  console.log(`\nProduct status summary verification written to ${receiptPath}`);

  if (receipt.status !== "passed") {
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

