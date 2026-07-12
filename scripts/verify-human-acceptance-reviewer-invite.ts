import fs from "node:fs";
import path from "node:path";

type VerificationCheck = {
  name: string;
  pass: boolean;
  evidence: string;
};

const rootDir = process.cwd();
const artifactsDir = path.join(rootDir, "artifacts", "productization");
const inviteJsonPath = path.join(artifactsDir, "human-acceptance-reviewer-invite.json");
const inviteMarkdownPath = path.join(artifactsDir, "human-acceptance-reviewer-invite.md");
const receiptPath = path.join(artifactsDir, "human-acceptance-reviewer-invite-verification.json");

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
  return readJson<T>(path.join(rootDir, relativePath));
}

function fileSize(targetPath: string) {
  return fs.existsSync(targetPath) ? fs.statSync(targetPath).size : 0;
}

function main() {
  const checks: VerificationCheck[] = [];
  const invite = readJson<{
    responseMode?: string;
    status?: string;
    canInviteHumanReviewer?: boolean;
    failedReasons?: string[];
    stableTaskId?: string;
    allSoftwareObjective?: string;
    releaseDecision?: string;
    reviewOnly?: boolean;
    accepted?: boolean;
    packagingGated?: boolean;
    canRelease?: boolean;
    canActivateRealModel?: boolean;
    inviteMessage?: string;
    maintainerChecklist?: string[];
    reviewerChecklist?: string[];
    expectedReturnedEvidence?: string[];
    reviewerEntrypoints?: Record<string, string>;
    launchPreflight?: {
      requiredImmediatelyBeforeContact?: boolean;
      command?: string;
      evidencePath?: string;
      mustBeGeneratedAfterReviewerKit?: boolean;
      mustPreserveReleaseLock?: boolean;
      stopIf?: string;
    };
    sourceEvidence?: {
      humanAcceptancePreflight?: { status?: string; canStartHumanAcceptance?: boolean; passed?: number; total?: number };
      reviewerKit?: {
        status?: string;
        canStartReviewerSession?: boolean;
        canRelease?: boolean;
        canActivateRealModel?: boolean;
        steps?: number;
        verificationStatus?: string;
        verificationCanRelease?: boolean;
        verificationCanActivateRealModel?: boolean;
        verificationPassed?: number;
        verificationTotal?: number;
      };
      receiptTemplate?: { status?: string; canRelease?: boolean; canActivateRealModel?: boolean; passed?: number; total?: number };
      returnIntake?: { status?: string; canRelease?: boolean; canActivateRealModel?: boolean; passed?: number; total?: number };
      humanAcceptanceGate?: { status?: string; latestEvidenceKind?: string; latestHumanReviewed?: boolean };
      releaseReadiness?: { status?: string; releaseDecision?: string; accepted?: unknown; packagingGated?: unknown; blockerCount?: number };
      statusSummary?: { status?: string; betaCanStart?: boolean; canRelease?: boolean; canActivateRealModel?: boolean };
    };
    locks?: {
      mustNotSaveAcceptanceFromInvite?: boolean;
      mustNotEnableRules?: boolean;
      mustNotUnlockPackaging?: boolean;
      mustNotClaimReleaseReady?: boolean;
      mustNotAcceptRealModel?: boolean;
      mustNotResumeAllSoftwareObjective?: boolean;
    };
    forbiddenOutcomes?: string[];
  }>(inviteJsonPath);
  const markdown = fs.existsSync(inviteMarkdownPath) ? fs.readFileSync(inviteMarkdownPath, "utf8") : "";
  const packageJson = readRepoJson<{ scripts?: Record<string, string> }>("package.json");
  const maintainerChecklist = invite?.maintainerChecklist ?? [];
  const reviewerChecklist = invite?.reviewerChecklist ?? [];
  const expectedReturnedEvidence = invite?.expectedReturnedEvidence ?? [];
  const launchPreflight = invite?.launchPreflight;

  push(
    checks,
    "Human acceptance reviewer invite JSON is ready",
    invite?.responseMode === "human_acceptance_reviewer_invite_json_v1" &&
      invite.status === "ready_to_invite_reviewer" &&
      invite.canInviteHumanReviewer === true &&
      (invite.failedReasons?.length ?? -1) === 0,
    `status=${invite?.status ?? "missing"}; canInvite=${invite?.canInviteHumanReviewer ?? "missing"}; failed=${
      invite?.failedReasons?.join(",") || "none"
    }`
  );

  push(
    checks,
    "Human acceptance reviewer invite preserves release and packaging locks",
    invite?.releaseDecision === "do_not_release" &&
      invite.allSoftwareObjective === "paused" &&
      invite.reviewOnly === true &&
      invite.accepted === false &&
      invite.packagingGated === true &&
      invite.canRelease === false &&
      invite.canActivateRealModel === false &&
      invite.locks?.mustNotSaveAcceptanceFromInvite === true &&
      invite.locks.mustNotEnableRules === true &&
      invite.locks.mustNotUnlockPackaging === true &&
      invite.locks.mustNotClaimReleaseReady === true &&
      invite.locks.mustNotAcceptRealModel === true &&
      invite.locks.mustNotResumeAllSoftwareObjective === true,
    `release=${invite?.releaseDecision ?? "missing"}; allSoftware=${invite?.allSoftwareObjective ?? "missing"}; accepted=${
      invite?.accepted ?? "missing"
    }; packagingGated=${invite?.packagingGated ?? "missing"}; canRelease=${invite?.canRelease ?? "missing"}; canActivateRealModel=${
      invite?.canActivateRealModel ?? "missing"
    }`
  );

  push(
    checks,
    "Human acceptance reviewer invite is backed by current launch evidence",
    invite?.sourceEvidence?.humanAcceptancePreflight?.status === "passed" &&
      invite.sourceEvidence.humanAcceptancePreflight.canStartHumanAcceptance === true &&
      invite.sourceEvidence.humanAcceptancePreflight.passed === invite.sourceEvidence.humanAcceptancePreflight.total &&
      invite.sourceEvidence.reviewerKit?.status === "ready_for_reviewer" &&
      invite.sourceEvidence.reviewerKit.canStartReviewerSession === true &&
      Number(invite.sourceEvidence.reviewerKit.steps ?? 0) >= 6 &&
      invite.sourceEvidence.reviewerKit.canRelease === false &&
      invite.sourceEvidence.reviewerKit.canActivateRealModel === false &&
      invite.sourceEvidence.reviewerKit.verificationStatus === "passed" &&
      invite.sourceEvidence.reviewerKit.verificationCanRelease === false &&
      invite.sourceEvidence.reviewerKit.verificationCanActivateRealModel === false &&
      invite.sourceEvidence.reviewerKit.verificationPassed === invite.sourceEvidence.reviewerKit.verificationTotal &&
      invite.sourceEvidence.receiptTemplate?.status === "template_ready" &&
      invite.sourceEvidence.receiptTemplate.canRelease === false &&
      invite.sourceEvidence.receiptTemplate.canActivateRealModel === false &&
      invite.sourceEvidence.receiptTemplate.passed === invite.sourceEvidence.receiptTemplate.total &&
      invite.sourceEvidence.returnIntake?.status === "passed" &&
      invite.sourceEvidence.returnIntake.canRelease === false &&
      invite.sourceEvidence.returnIntake.canActivateRealModel === false &&
      invite.sourceEvidence.returnIntake.passed === invite.sourceEvidence.returnIntake.total &&
      invite.sourceEvidence.humanAcceptanceGate?.status === "blocked_needs_human_review" &&
      invite.sourceEvidence.humanAcceptanceGate.latestEvidenceKind === "automated_browser_smoke" &&
      invite.sourceEvidence.humanAcceptanceGate.latestHumanReviewed === false &&
      invite.sourceEvidence.releaseReadiness?.releaseDecision === "do_not_release" &&
      invite.sourceEvidence.releaseReadiness.accepted === false &&
      invite.sourceEvidence.releaseReadiness.packagingGated === true &&
      invite.sourceEvidence.statusSummary?.canRelease === false &&
      invite.sourceEvidence.statusSummary.canActivateRealModel === false,
    `preflight=${invite?.sourceEvidence?.humanAcceptancePreflight?.status ?? "missing"} ${
      invite?.sourceEvidence?.humanAcceptancePreflight?.passed ?? "?"
    }/${invite?.sourceEvidence?.humanAcceptancePreflight?.total ?? "?"}; kit=${
      invite?.sourceEvidence?.reviewerKit?.status ?? "missing"
    }/${invite?.sourceEvidence?.reviewerKit?.verificationStatus ?? "missing"}; receipt=${
      invite?.sourceEvidence?.receiptTemplate?.status ?? "missing"
    }; gate=${invite?.sourceEvidence?.humanAcceptanceGate?.status ?? "missing"}; release=${
      invite?.sourceEvidence?.releaseReadiness?.releaseDecision ?? "missing"
    }`
  );

  push(
    checks,
    "Human acceptance reviewer invite requires immediate live preflight before contact",
    launchPreflight?.requiredImmediatelyBeforeContact === true &&
      launchPreflight.command === "npm run preflight:human-acceptance -- --base-url http://127.0.0.1:3000" &&
      launchPreflight.evidencePath === "artifacts/productization/human-acceptance-session-preflight.json" &&
      launchPreflight.mustBeGeneratedAfterReviewerKit === true &&
      launchPreflight.mustPreserveReleaseLock === true &&
      launchPreflight.stopIf?.includes("Do not contact reviewer") === true &&
      maintainerChecklist.some((item) => item.includes(launchPreflight.command ?? "missing")) &&
      markdown.includes("Launch Preflight") &&
      markdown.includes(launchPreflight.evidencePath ?? "missing"),
    `command=${launchPreflight?.command ?? "missing"}; evidence=${launchPreflight?.evidencePath ?? "missing"}; required=${
      launchPreflight?.requiredImmediatelyBeforeContact ?? "missing"
    }`
  );

  push(
    checks,
    "Human acceptance reviewer invite has actionable reviewer and maintainer instructions",
    invite?.stableTaskId === "task-photo-travel-journal" &&
      invite.inviteMessage?.includes("real human acceptance review") === true &&
      reviewerChecklist.length >= 6 &&
      reviewerChecklist.some((item) => item.includes("/manual-test")) &&
      reviewerChecklist.some((item) => item.includes("/tasks/task-photo-travel-journal/run")) &&
      reviewerChecklist.some((item) => item.includes("human-acceptance-receipt.template.json")) &&
      maintainerChecklist.length >= 7 &&
      maintainerChecklist.some((item) => item.includes("verify:human-acceptance-receipt -- --receipt")) &&
      maintainerChecklist.some((item) => item.includes("intake:human-acceptance-return")) &&
      invite.reviewerEntrypoints?.manualTest === "http://127.0.0.1:3000/manual-test" &&
      invite.reviewerEntrypoints?.reviewerKit === "artifacts/productization/human-acceptance-reviewer-kit.md" &&
      invite.reviewerEntrypoints?.receiptTemplate === "artifacts/productization/human-acceptance-receipt.template.json",
    `reviewerSteps=${reviewerChecklist.length}; maintainerSteps=${maintainerChecklist.length}; manualTest=${
      invite?.reviewerEntrypoints?.manualTest ?? "missing"
    }`
  );

  push(
    checks,
    "Human acceptance reviewer invite requests real returned evidence",
    expectedReturnedEvidence.some((item) => item.includes("evidenceKind=human_review")) &&
      expectedReturnedEvidence.some((item) => item.includes("verify:human-acceptance-receipt -- --receipt")) &&
      expectedReturnedEvidence.some((item) => item.includes("human-acceptance-gate.json")) &&
      markdown.includes("humanReviewed=true") &&
      markdown.includes("do_not_release") &&
      markdown.includes("accepted=false") &&
      markdown.includes("packagingGated=true") &&
      markdown.includes("canRelease=false") &&
      markdown.includes("canActivateRealModel=false") &&
      fileSize(inviteMarkdownPath) > 1000,
    `markdownBytes=${fileSize(inviteMarkdownPath)}; expectedEvidence=${expectedReturnedEvidence.length}`
  );

  push(
    checks,
    "Human acceptance reviewer invite scripts are registered and non-accepting",
    packageJson?.scripts?.["build:human-acceptance-reviewer-invite"] ===
      "tsx scripts/build-human-acceptance-reviewer-invite.ts" &&
      packageJson.scripts?.["verify:human-acceptance-reviewer-invite"] ===
        "tsx scripts/verify-human-acceptance-reviewer-invite.ts" &&
      invite?.forbiddenOutcomes?.some((item) => item.includes("product acceptance")) === true &&
      invite.forbiddenOutcomes.some((item) => item.includes("release readiness")) &&
      !markdown.includes("accepted=true") &&
      !markdown.includes("packagingGated=false") &&
      !markdown.includes("releaseDecision=release_ready"),
    `buildScript=${packageJson?.scripts?.["build:human-acceptance-reviewer-invite"] ?? "missing"}; verifyScript=${
      packageJson?.scripts?.["verify:human-acceptance-reviewer-invite"] ?? "missing"
    }; forbidden=${invite?.forbiddenOutcomes?.length ?? 0}`
  );

  const passed = checks.filter((check) => check.pass).length;
  const verification = {
    responseMode: "human_acceptance_reviewer_invite_verification_json_v1",
    status: passed === checks.length ? "passed" : "failed",
    generatedAt: new Date().toISOString(),
    command: "npm run verify:human-acceptance-reviewer-invite",
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
        ? "Run the live human acceptance preflight, then send human-acceptance-reviewer-invite.md to one real reviewer; validate returned evidence before using it in release readiness."
        : "Fix the human acceptance reviewer invite before contacting a real reviewer."
  };

  fs.mkdirSync(artifactsDir, { recursive: true });
  fs.writeFileSync(receiptPath, `${JSON.stringify(verification, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(verification, null, 2));
  console.log(`\nHuman acceptance reviewer invite verification written to ${receiptPath}`);

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