import fs from "node:fs";
import path from "node:path";

type VerificationCheck = {
  name: string;
  pass: boolean;
  evidence: string;
};

const artifactsDir = path.join(process.cwd(), "artifacts", "productization");
const boardJsonPath = path.join(artifactsDir, "product-release-blocker-board.json");
const boardMarkdownPath = path.join(artifactsDir, "product-release-blocker-board.md");
const receiptPath = path.join(artifactsDir, "product-release-blocker-board-verification.json");

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

function readRepoJson<T>(relativePath: string): T | null {
  return readJson<T>(path.join(process.cwd(), relativePath));
}

function fileSize(targetPath: string) {
  return fs.existsSync(targetPath) ? fs.statSync(targetPath).size : 0;
}

function intakeBeforeVerifier(commands: string[] | undefined, intakePrefix: string, verifier: string) {
  const intakeIndex = commands?.findIndex((command) => command.startsWith(intakePrefix)) ?? -1;
  const verifierIndex = commands?.indexOf(verifier) ?? -1;
  return intakeIndex >= 0 && verifierIndex > intakeIndex;
}

function main() {
  const checks: VerificationCheck[] = [];
  const board = readJson<{
    responseMode?: string;
    status?: string;
    releaseDecision?: string;
    reviewOnly?: boolean;
    accepted?: boolean;
    packagingGated?: boolean;
    canRelease?: boolean;
    canActivateRealModel?: boolean;
    allSoftwareObjective?: string;
    failedReasons?: string[];
    lanes?: Array<{
      id?: string;
      status?: string;
      evidencePaths?: string[];
      commands?: string[];
      continueCondition?: string;
      stopCondition?: string;
    }>;
    sourceEvidence?: {
      releaseReadiness?: { status?: string; releaseDecision?: string; blockerCount?: number };
      humanAcceptance?: {
        gateStatus?: string;
        evidenceKind?: string;
        reviewerKit?: string;
        reviewerInvite?: string;
        reviewerInviteCanSend?: boolean;
        reviewerInviteVerification?: string;
      };
      aiService?: { activeProvider?: string; realModelReady?: boolean };
      packagingBoundary?: { accepted?: boolean; packagingGated?: boolean };
      publicBeta?: { status?: string; betaCanStart?: boolean; passed?: number; total?: number };
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
    };
    forbiddenTransitions?: string[];
  }>(boardJsonPath);
  const markdown = fs.existsSync(boardMarkdownPath) ? fs.readFileSync(boardMarkdownPath, "utf8") : "";
  const packageJson = readRepoJson<{ scripts?: Record<string, string> }>("package.json");
  const publicBetaReadiness = readRepoJson<{
    responseMode?: string;
    status?: string;
    betaCanStart?: boolean;
    passed?: number;
    total?: number;
  }>("artifacts/productization/public-beta-readiness.json");
  const laneIds = new Set((board?.lanes ?? []).map((lane) => lane.id));
  const humanLane = board?.lanes?.find((lane) => lane.id === "real_human_acceptance");
  const realModelLane = board?.lanes?.find((lane) => lane.id === "real_model_adapter");
  const packagingLane = board?.lanes?.find((lane) => lane.id === "packaging_release_lock");

  push(
    checks,
    "Blocker board JSON is ready",
    board?.responseMode === "product_release_blocker_board_json_v1" &&
      board.status === "ready_for_blocker_resolution" &&
      (board.failedReasons?.length ?? -1) === 0,
    `status=${board?.status ?? "missing"}; failed=${board?.failedReasons?.join(",") || "none"}`
  );

  push(
    checks,
    "Blocker board preserves release locks",
    board?.releaseDecision === "do_not_release" &&
      board.reviewOnly === true &&
      board.accepted === false &&
      board.packagingGated === true &&
      board.canRelease === false &&
      board.canActivateRealModel === false &&
      board.allSoftwareObjective === "paused",
    `release=${board?.releaseDecision ?? "missing"}; accepted=${board?.accepted ?? "missing"}; packagingGated=${
      board?.packagingGated ?? "missing"
    }; canRelease=${board?.canRelease ?? "missing"}; canActivateRealModel=${
      board?.canActivateRealModel ?? "missing"
    }`
  );

  push(
    checks,
    "Blocker board covers every release blocker lane",
    laneIds.has("real_human_acceptance") &&
      laneIds.has("real_model_adapter") &&
      laneIds.has("packaging_release_lock") &&
      (board?.lanes?.length ?? 0) === 3,
    `lanes=${Array.from(laneIds).join(",") || "missing"}`
  );

  push(
    checks,
    "Blocker board is backed by current release evidence",
    board?.sourceEvidence?.releaseReadiness?.status === "blocked_not_release_ready" &&
      board.sourceEvidence.releaseReadiness.releaseDecision === "do_not_release" &&
      (board.sourceEvidence.releaseReadiness.blockerCount ?? 0) >= 3 &&
      board.sourceEvidence.publicBeta?.status === "passed" &&
      board.sourceEvidence.publicBeta.betaCanStart === true &&
      publicBetaReadiness?.status === "passed" &&
      publicBetaReadiness.betaCanStart === true &&
      board.sourceEvidence.publicBeta.passed === publicBetaReadiness.passed &&
      board.sourceEvidence.publicBeta.total === publicBetaReadiness.total &&
      board.sourceEvidence.publicBetaFeedback?.collectionVerification === "passed" &&
      board.sourceEvidence.publicBetaFeedback.followUpVerification === "passed" &&
      Number(board.sourceEvidence.publicBetaFeedback.followUpActions ?? 0) >= 1,
    `release=${board?.sourceEvidence?.releaseReadiness?.status ?? "missing"}; blockers=${
      board?.sourceEvidence?.releaseReadiness?.blockerCount ?? "?"
    }; beta=${board?.sourceEvidence?.publicBeta?.status ?? "missing"} ${board?.sourceEvidence?.publicBeta?.passed ?? "?"}/${board?.sourceEvidence?.publicBeta?.total ?? "?"}; currentBeta=${publicBetaReadiness?.status ?? "missing"} ${publicBetaReadiness?.passed ?? "?"}/${publicBetaReadiness?.total ?? "?"}; feedback=${
      board?.sourceEvidence?.publicBetaFeedback?.followUpVerification ?? "missing"
    }`
  );

  push(
    checks,
    "Human acceptance lane points to reviewer evidence",
    board?.lanes?.some(
      (lane) =>
        lane.id === "real_human_acceptance" &&
        lane.status === "blocked_needs_reviewer" &&
        lane.evidencePaths?.some((item) => item.includes("human-acceptance-reviewer-kit.md")) === true &&
        lane.evidencePaths.some((item) => item.includes("human-acceptance-reviewer-invite.md")) &&
        lane.evidencePaths.some((item) => item.includes("human-acceptance-reviewer-invite-verification.json")) &&
        lane.evidencePaths.some((item) => item.includes("human-acceptance-receipt.template.json")) &&
        lane.evidencePaths.some((item) => item.includes("manual-acceptance-latest.json")) &&
        lane.evidencePaths.some((item) => item.includes("public-beta-feedback-collection.json")) &&
        lane.evidencePaths.some((item) => item.includes("public-beta-follow-up-plan.json")) &&
        lane.evidencePaths.some((item) => item.includes("public-beta-return-intake-verification.json")) &&
        lane.commands?.includes("npm run build:human-acceptance-reviewer-invite") === true &&
        lane.commands?.includes("npm run verify:human-acceptance-reviewer-invite") === true &&
        lane.commands?.includes("npm run build:human-acceptance-receipt-template") === true &&
        lane.commands?.includes("npm run verify:human-acceptance-receipt") === true &&
        lane.commands?.includes("npm run verify:human-acceptance-return-intake") === true &&
        lane.commands?.some((command) => command.startsWith("npm run intake:human-acceptance-return")) === true &&
        lane.commands?.includes("npm run collect:public-beta-feedback") === true &&
        lane.commands?.includes("npm run verify:public-beta-feedback-collection") === true &&
        lane.commands?.includes("npm run plan:public-beta-follow-up") === true &&
        lane.commands?.includes("npm run verify:public-beta-follow-up-plan") === true &&
        lane.commands?.includes("npm run preflight:public-beta-tester -- --base-url http://127.0.0.1:3000") === true &&
        lane.commands?.includes("npm run intake:public-beta-return -- --receipt path/to/submitted-feedback.json --session-receipt path/to/filled-public-beta-session-receipt.json --send-receipt-validation artifacts/productization/first-real-tester-send-receipt-validation.json") === true &&
        lane.commands?.includes("npm run verify:human-acceptance") === true &&
        lane.stopCondition?.includes("automated_browser_smoke") === true &&
        lane.stopCondition.includes("beta feedback") &&
        lane.continueCondition?.includes("public beta returned feedback") === true
    ) === true &&
      board?.sourceEvidence?.humanAcceptance?.reviewerInvite === "ready_to_invite_reviewer" &&
      board.sourceEvidence.humanAcceptance.reviewerInviteCanSend === true &&
      board.sourceEvidence.humanAcceptance.reviewerInviteVerification === "passed",
    `humanGate=${board?.sourceEvidence?.humanAcceptance?.gateStatus ?? "missing"}; reviewerKit=${
      board?.sourceEvidence?.humanAcceptance?.reviewerKit ?? "missing"
    }; reviewerInvite=${board?.sourceEvidence?.humanAcceptance?.reviewerInvite ?? "missing"}; inviteCanSend=${
      board?.sourceEvidence?.humanAcceptance?.reviewerInviteCanSend ?? "missing"
    }; feedback=${board?.sourceEvidence?.publicBetaFeedback?.followUpStatus ?? "missing"}`
  );

  push(
    checks,
    "Return receipt lanes run intake before return-intake verification",
    intakeBeforeVerifier(
      humanLane?.commands,
      "npm run intake:human-acceptance-return",
      "npm run verify:human-acceptance-return-intake"
    ) &&
      intakeBeforeVerifier(
        realModelLane?.commands,
        "npm run intake:real-model-trial-return",
        "npm run verify:real-model-trial-return-intake"
      ) &&
      intakeBeforeVerifier(
        packagingLane?.commands,
        "npm run intake:product-release-approval-return",
        "npm run verify:product-release-approval-return-intake"
      ),
    `human=${humanLane?.commands?.join(" > ") ?? "missing"}; realModel=${
      realModelLane?.commands?.join(" > ") ?? "missing"
    }; packaging=${packagingLane?.commands?.join(" > ") ?? "missing"}`
  );

  push(
    checks,
    "Real model lane stays separately accepted",
    board?.lanes?.some(
      (lane) =>
        lane.id === "real_model_adapter" &&
        lane.status === "blocked_mock_or_unaccepted" &&
        lane.evidencePaths?.some((item) => item.includes("real-model-adapter-contract-verification.json")) ===
          true &&
        lane.evidencePaths?.some((item) => item.includes("real-model-trial-kit.md")) === true &&
        lane.evidencePaths.some((item) => item.includes("real-model-trial-receipt.template.json")) &&
        lane.commands?.includes("npm run verify:real-model-adapter-contract") === true &&
        lane.commands?.includes("npm run build:real-model-trial-kit") === true &&
        lane.commands.includes("npm run verify:real-model-trial-kit") &&
        lane.commands.includes("npm run build:real-model-trial-receipt-template") &&
        lane.commands.includes("npm run verify:real-model-trial-receipt") &&
        lane.commands.includes("npm run verify:real-model-trial-return-intake") &&
        lane.commands.some((command) => command.startsWith("npm run intake:real-model-trial-return")) &&
        lane.commands?.includes("GET /api/ai-service-status") === true &&
        lane.stopCondition?.includes("activeProvider remains mock") === true &&
        lane.continueCondition?.includes("AI_PROVIDER_MANUAL_ACCEPTED=true") === true
    ) === true &&
      board?.sourceEvidence?.aiService?.activeProvider === "mock" &&
      board.sourceEvidence.aiService.realModelReady === false,
    `activeProvider=${board?.sourceEvidence?.aiService?.activeProvider ?? "missing"}; realModelReady=${
      board?.sourceEvidence?.aiService?.realModelReady ?? "missing"
    }`
  );

  push(
    checks,
    "Packaging lane keeps release approval separate",
    board?.lanes?.some(
      (lane) =>
        lane.id === "packaging_release_lock" &&
        lane.status === "locked_expected" &&
        lane.evidencePaths?.some((item) => item.includes("product-release-approval.template.json")) === true &&
        lane.commands?.includes("npm run build:product-release-approval-template") === true &&
        lane.commands?.includes("npm run verify:product-release-approval") === true &&
        lane.commands?.includes("npm run verify:product-release-approval-return-intake") === true &&
        lane.commands?.some((command) => command.startsWith("npm run intake:product-release-approval-return")) === true &&
        lane.commands?.includes("npm run verify:product-release-readiness -- --allow-blocked") === true &&
        lane.stopCondition?.includes("accepted=true") === true &&
        lane.continueCondition?.includes("separate release approval") === true
    ) === true &&
      board?.sourceEvidence?.packagingBoundary?.accepted === false &&
      board.sourceEvidence.packagingBoundary.packagingGated === true,
    `accepted=${board?.sourceEvidence?.packagingBoundary?.accepted ?? "missing"}; packagingGated=${
      board?.sourceEvidence?.packagingBoundary?.packagingGated ?? "missing"
    }`
  );

  push(
    checks,
    "Blocker board Markdown is actionable and explicit",
    markdown.includes("Product Release Blocker Board") &&
      markdown.includes("Real human acceptance") &&
      markdown.includes("npm run plan:public-beta-follow-up") &&
      markdown.includes("npm run intake:public-beta-return -- --receipt path/to/submitted-feedback.json --session-receipt path/to/filled-public-beta-session-receipt.json --send-receipt-validation artifacts/productization/first-real-tester-send-receipt-validation.json") &&
      markdown.includes("Real model adapter acceptance") &&
      markdown.includes("Packaging and release approval") &&
      markdown.includes("do_not_release") &&
      markdown.includes("accepted=false") &&
      markdown.includes("packagingGated=true") &&
      markdown.includes("Can activate real model: `false`") &&
      markdown.includes("canActivateRealModel=false") &&
      fileSize(boardMarkdownPath) > 1000,
    `markdownBytes=${fileSize(boardMarkdownPath)}`
  );

  push(
    checks,
    "Blocker board package scripts are registered",
    packageJson?.scripts?.["build:product-release-blocker-board"] ===
      "tsx scripts/build-product-release-blocker-board.ts" &&
      packageJson.scripts?.["verify:product-release-blocker-board"] ===
        "tsx scripts/verify-product-release-blocker-board.ts",
    `buildScript=${packageJson?.scripts?.["build:product-release-blocker-board"] ?? "missing"}; verifyScript=${
      packageJson?.scripts?.["verify:product-release-blocker-board"] ?? "missing"
    }`
  );

  push(
    checks,
    "Blocker board does not claim forbidden outcomes",
    board?.forbiddenTransitions?.some((item) => item.includes("unlock packaging")) === true &&
      board.forbiddenTransitions.some((item) => item.includes("release readiness")) &&
      board.releaseDecision === "do_not_release" &&
      board.accepted === false &&
      board.packagingGated === true &&
      board.canRelease === false &&
      board.canActivateRealModel === false &&
      !markdown.includes("Release decision: `release_candidate`") &&
      !markdown.includes("Can release: `true`") &&
      !markdown.includes("Can activate real model: `true`"),
    `forbiddenTransitions=${board?.forbiddenTransitions?.length ?? 0}`
  );

  const passed = checks.filter((check) => check.pass).length;
  const verification = {
    responseMode: "product_release_blocker_board_verification_json_v1",
    status: passed === checks.length ? "passed" : "failed",
    generatedAt: new Date().toISOString(),
    command: "npm run verify:product-release-blocker-board",
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
        ? "Use product-release-blocker-board.md as the maintainer action board for resolving release blockers without unlocking release."
        : "Fix the blocker board before using it for release follow-up planning."
  };

  fs.mkdirSync(artifactsDir, { recursive: true });
  fs.writeFileSync(receiptPath, JSON.stringify(verification, null, 2));
  console.log(JSON.stringify(verification, null, 2));
  console.log(`\nProduct release blocker board verification written to ${receiptPath}`);

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
