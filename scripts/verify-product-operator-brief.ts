import fs from "node:fs";
import path from "node:path";

type OperatorBriefCheck = {
  name: string;
  pass: boolean;
  evidence: string;
};

const artifactsDir = path.join(process.cwd(), "artifacts", "productization");
const briefPath = path.join(artifactsDir, "product-operator-brief.json");
const markdownPath = path.join(artifactsDir, "product-operator-brief.md");
const receiptPath = path.join(artifactsDir, "product-operator-brief-verification.json");

function push(checks: OperatorBriefCheck[], name: string, pass: boolean, evidence: string) {
  checks.push({ name, pass, evidence });
}

function fileExistsWithSize(relativePath: string, minimumBytes = 1) {
  const fullPath = path.join(process.cwd(), relativePath);
  return fs.existsSync(fullPath) && fs.statSync(fullPath).size >= minimumBytes;
}

function main() {
  const checks: OperatorBriefCheck[] = [];
  const brief = fs.existsSync(briefPath)
    ? (JSON.parse(fs.readFileSync(briefPath, "utf8")) as {
        responseMode?: string;
        status?: string;
        productScope?: string;
        allSoftwareObjective?: string;
        releaseDecision?: string;
        reviewOnly?: boolean;
        accepted?: boolean;
        packagingGated?: boolean;
        canRelease?: boolean;
        canInviteBoundedBetaTester?: boolean;
        canStartHumanAcceptanceReview?: boolean;
        canProcessBetaFeedbackLoop?: boolean;
        canPlanRealModelTrial?: boolean;
        canActivateRealModel?: boolean;
        failedReasons?: string[];
        sourceEvidence?: {
          health?: { status?: string; passed?: number; total?: number };
          smoke?: { status?: string; passed?: number; total?: number };
          handoff?: { status?: string; passed?: number; total?: number };
          publicBeta?: { status?: string; betaCanStart?: boolean; passed?: number; total?: number };
          testerRunbook?: { ready?: boolean; path?: string; packetOverview?: string };
          publicBetaSessionPlan?: {
            ready?: boolean;
            path?: string;
            status?: string;
            verification?: string;
            timeboxMinutes?: number;
            phases?: number;
            launchPreflight?: string;
          };
          publicBetaSessionReceipt?: {
            ready?: boolean;
            path?: string;
            status?: string;
            verification?: string;
            mode?: string;
            releaseDecision?: string;
            reviewOnly?: boolean;
            accepted?: boolean;
            packagingGated?: boolean;
            canRelease?: boolean;
          };
          humanAcceptance?: {
            latestEvidenceKind?: string;
            latestHumanReviewed?: boolean;
            reviewerInvite?: string;
            reviewerInviteCanSend?: boolean;
            reviewerInviteVerification?: string;
            reviewerInvitePath?: string;
          };
          publicBetaFeedback?: {
            collectionStatus?: string;
            totalReceipts?: number;
            validReceipts?: number;
            invalidReceipts?: number;
            collectionVerification?: string;
            followUpStatus?: string;
            canInviteNextTester?: boolean;
            followUpActions?: number;
            followUpVerification?: string;
          };
          realModel?: { activeProvider?: string; realModelReady?: boolean; adapterContractStatus?: string };
          release?: { status?: string; releaseDecision?: string; blockerCount?: number; accepted?: boolean; packagingGated?: boolean };
        };
        immediateActions?: Array<{
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
        blockedActions?: Array<{ id?: string; blocked?: boolean; reason?: string }>;
      })
    : null;
  const markdown = fs.existsSync(markdownPath) ? fs.readFileSync(markdownPath, "utf8") : "";

  push(
    checks,
    "Operator brief exists and is ready for handoff",
    brief?.responseMode === "product_operator_brief_json_v1" &&
      brief.status === "ready_for_operator_handoff" &&
      fileExistsWithSize("artifacts/productization/product-operator-brief.json", 100) &&
      fileExistsWithSize("artifacts/productization/product-operator-brief.md", 1000),
    `status=${brief?.status ?? "missing"}; markdown=${markdown.length}`
  );

  push(
    checks,
    "Operator brief preserves product boundaries",
    brief?.productScope === "bounded_core_teaching_loop" &&
      brief.allSoftwareObjective === "paused" &&
      brief.releaseDecision === "do_not_release" &&
      brief.reviewOnly === true &&
      brief.accepted === false &&
      brief.packagingGated === true &&
      brief.canRelease === false &&
      brief.canActivateRealModel === false,
    `scope=${brief?.productScope ?? "missing"}; release=${brief?.releaseDecision ?? "missing"}; accepted=${
      brief?.accepted ?? "missing"
    }; packagingGated=${brief?.packagingGated ?? "missing"}; canRelease=${brief?.canRelease ?? "missing"}; canActivateRealModel=${
      brief?.canActivateRealModel ?? "missing"
    }`
  );

  push(
    checks,
    "Operator brief exposes allowed next actions",
    brief?.canInviteBoundedBetaTester === true &&
      brief.canStartHumanAcceptanceReview === true &&
      brief.canProcessBetaFeedbackLoop === true &&
      brief.canPlanRealModelTrial === true &&
      brief.immediateActions?.some(
        (action) =>
          action.id === "invite_one_bounded_beta_tester" &&
          action.allowed === true &&
          action.command === "npm run preflight:public-beta-tester -- --base-url http://127.0.0.1:3000" &&
          action.evidencePath === "artifacts/productization/public-beta-packet/START_PUBLIC_BETA.md" &&
          action.testerRunbookPath === "artifacts/productization/public-beta-packet/docs/PUBLIC_BETA_TESTER_RUNBOOK.md" &&
          action.sessionPlanPath === "artifacts/productization/public-beta-packet/docs/PUBLIC_BETA_SESSION_PLAN.md" &&
          action.sessionReceiptTemplatePath ===
            "artifacts/productization/public-beta-packet/docs/PUBLIC_BETA_SESSION_RECEIPT.template.json"
      ) === true &&
      brief.immediateActions.some(
        (action) =>
          action.id === "run_real_human_acceptance_review" &&
          action.allowed === true &&
          action.evidencePath === "artifacts/productization/human-acceptance-reviewer-invite.md" &&
          action.reviewerKitPath === "artifacts/productization/human-acceptance-reviewer-kit.md"
      ) &&
      brief.immediateActions.some(
        (action) =>
          action.id === "process_returned_public_beta_feedback" &&
          action.allowed === true &&
          action.command === "npm run intake:public-beta-return -- --receipt path/to/submitted-feedback.json --session-receipt path/to/filled-public-beta-session-receipt.json --send-receipt-validation artifacts/productization/first-real-tester-send-receipt-validation.json" &&
          action.evidencePath === "artifacts/productization/public-beta-follow-up-plan.json" &&
          action.stopCondition?.includes("tester.name/tester.date") === true &&
          action.stopCondition?.includes("sessionEvidence.feedbackReceiptPath") === true
      ) &&
      brief.immediateActions.some((action) => action.id === "plan_separate_real_model_trial" && action.allowed === true),
    `beta=${brief?.canInviteBoundedBetaTester ?? "missing"}; human=${
      brief?.canStartHumanAcceptanceReview ?? "missing"
    }; feedback=${brief?.canProcessBetaFeedbackLoop ?? "missing"}; modelTrial=${
      brief?.canPlanRealModelTrial ?? "missing"
    }; actions=${brief?.immediateActions?.length ?? 0}`
  );

  push(
    checks,
    "Operator brief blocks release-only transitions",
    brief?.blockedActions?.some((action) => action.id === "release_product" && action.blocked === true) === true &&
      brief.blockedActions.some((action) => action.id === "unlock_packaging" && action.blocked === true) &&
      brief.blockedActions.some((action) => action.id === "resume_all_software_scope" && action.blocked === true) &&
      brief.blockedActions.some((action) => action.id === "activate_real_model_from_fake_fetch" && action.blocked === true),
    `blocked=${brief?.blockedActions?.map((action) => action.id).join(",") ?? "missing"}`
  );

  push(
    checks,
    "Operator brief source evidence matches current gates",
    brief?.sourceEvidence?.health?.status === "passed" &&
      brief.sourceEvidence.smoke?.status === "passed" &&
      brief.sourceEvidence.publicBeta?.status === "passed" &&
      brief.sourceEvidence.publicBeta.betaCanStart === true &&
      brief.sourceEvidence.testerRunbook?.ready === true &&
      brief.sourceEvidence.testerRunbook.path === "artifacts/productization/public-beta-packet/docs/PUBLIC_BETA_TESTER_RUNBOOK.md" &&
      brief.sourceEvidence.testerRunbook.packetOverview === "artifacts/productization/public-beta-packet/START_PUBLIC_BETA.md" &&
      fileExistsWithSize("artifacts/productization/public-beta-packet/docs/PUBLIC_BETA_TESTER_RUNBOOK.md", 1000) &&
      brief.sourceEvidence.publicBetaSessionPlan?.ready === true &&
      brief.sourceEvidence.publicBetaSessionPlan.path === "artifacts/productization/public-beta-packet/docs/PUBLIC_BETA_SESSION_PLAN.md" &&
      brief.sourceEvidence.publicBetaSessionPlan.status === "ready_for_session" &&
      /^passed ([1-9][0-9]*)\/\1$/.test(brief.sourceEvidence.publicBetaSessionPlan.verification ?? "") &&
      Number(brief.sourceEvidence.publicBetaSessionPlan.timeboxMinutes ?? 0) >= 30 &&
      Number(brief.sourceEvidence.publicBetaSessionPlan.phases ?? 0) >= 4 &&
      brief.sourceEvidence.publicBetaSessionPlan.launchPreflight === "npm run preflight:public-beta-tester -- --base-url http://127.0.0.1:3000" &&
      fileExistsWithSize("artifacts/productization/public-beta-packet/docs/PUBLIC_BETA_SESSION_PLAN.md", 1000) &&
      brief.sourceEvidence.publicBetaSessionReceipt?.ready === true &&
      brief.sourceEvidence.publicBetaSessionReceipt.path ===
        "artifacts/productization/public-beta-packet/docs/PUBLIC_BETA_SESSION_RECEIPT.template.json" &&
      brief.sourceEvidence.publicBetaSessionReceipt.status === "template_ready" &&
      brief.sourceEvidence.publicBetaSessionReceipt.verification === "template_ready 9/9" &&
      brief.sourceEvidence.publicBetaSessionReceipt.mode === "template" &&
      brief.sourceEvidence.publicBetaSessionReceipt.releaseDecision === "do_not_release" &&
      brief.sourceEvidence.publicBetaSessionReceipt.reviewOnly === true &&
      brief.sourceEvidence.publicBetaSessionReceipt.accepted === false &&
      brief.sourceEvidence.publicBetaSessionReceipt.packagingGated === true &&
      brief.sourceEvidence.publicBetaSessionReceipt.canRelease === false &&
      fileExistsWithSize("artifacts/productization/public-beta-packet/docs/PUBLIC_BETA_SESSION_RECEIPT.template.json", 1000) &&
      brief.sourceEvidence.humanAcceptance?.latestEvidenceKind === "automated_browser_smoke" &&
      brief.sourceEvidence.humanAcceptance.latestHumanReviewed === false &&
      brief.sourceEvidence.humanAcceptance.reviewerInvite === "ready_to_invite_reviewer" &&
      brief.sourceEvidence.humanAcceptance.reviewerInviteCanSend === true &&
      brief.sourceEvidence.humanAcceptance.reviewerInviteVerification === "passed 7/7" &&
      brief.sourceEvidence.humanAcceptance.reviewerInvitePath === "artifacts/productization/human-acceptance-reviewer-invite.md" &&
      fileExistsWithSize("artifacts/productization/human-acceptance-reviewer-invite.md", 1000) &&
      brief.sourceEvidence.publicBetaFeedback?.collectionVerification === "passed" &&
      brief.sourceEvidence.publicBetaFeedback.followUpVerification === "passed" &&
      Number(brief.sourceEvidence.publicBetaFeedback.followUpActions ?? 0) >= 1 &&
      brief.sourceEvidence.realModel?.activeProvider === "mock" &&
      brief.sourceEvidence.realModel.realModelReady === false &&
      brief.sourceEvidence.realModel.adapterContractStatus === "passed" &&
      brief.sourceEvidence.release?.status === "blocked_not_release_ready" &&
      brief.sourceEvidence.release.releaseDecision === "do_not_release" &&
      Number(brief.sourceEvidence.release.blockerCount ?? 0) >= 3 &&
      brief.sourceEvidence.release.accepted === false &&
      brief.sourceEvidence.release.packagingGated === true,
    `health=${brief?.sourceEvidence?.health?.status ?? "missing"}; beta=${
      brief?.sourceEvidence?.publicBeta?.status ?? "missing"
    }; humanEvidence=${brief?.sourceEvidence?.humanAcceptance?.latestEvidenceKind ?? "missing"}; provider=${
      brief?.sourceEvidence?.realModel?.activeProvider ?? "missing"
    }; release=${brief?.sourceEvidence?.release?.status ?? "missing"}`
  );

  push(
    checks,
    "Operator brief Markdown is readable and actionable",
    markdown.includes("Product Operator Brief") &&
      markdown.includes("Invite bounded beta tester") &&
      markdown.includes("Tester runbook") &&
      markdown.includes("PUBLIC_BETA_TESTER_RUNBOOK.md") &&
      markdown.includes("Session plan") &&
      markdown.includes("PUBLIC_BETA_SESSION_PLAN.md") &&
      markdown.includes("Session receipt template") &&
      markdown.includes("PUBLIC_BETA_SESSION_RECEIPT.template.json") &&
      markdown.includes("Start real human acceptance review") &&
      markdown.includes("human-acceptance-reviewer-invite.md") &&
      markdown.includes("Process returned public beta feedback") &&
      markdown.includes("public-beta-follow-up-plan.json") &&
      markdown.includes("sessionEvidence.feedbackReceiptPath") &&
      markdown.includes("Plan separate real-model trial") &&
      markdown.includes("Release product") &&
      markdown.includes("This brief is review-only") &&
      markdown.includes("`canActivateRealModel=false`") &&
      markdown.includes("Failed Reasons") &&
      !markdown.includes("濞寸姴瀛"),
    `bytes=${markdown.length}`
  );

  const passed = checks.filter((check) => check.pass).length;
  const receipt = {
    responseMode: "product_operator_brief_verification_json_v1",
    status: passed === checks.length ? "passed" : "failed",
    generatedAt: new Date().toISOString(),
    command: "npm run verify:product-operator-brief",
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
        ? "Use artifacts/productization/product-operator-brief.md as the single next-step handoff for beta, human acceptance, and real-model trial planning."
        : "Fix the failed operator brief checks, then rebuild and verify it."
  };

  fs.mkdirSync(artifactsDir, { recursive: true });
  fs.writeFileSync(receiptPath, JSON.stringify(receipt, null, 2));
  console.log(JSON.stringify(receipt, null, 2));
  console.log(`\nProduct operator brief verification written to ${receiptPath}`);

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


