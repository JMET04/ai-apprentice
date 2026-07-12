import fs from "node:fs";
import path from "node:path";

type VerificationCheck = {
  name: string;
  pass: boolean;
  evidence: string;
};

const artifactsDir = path.join(process.cwd(), "artifacts", "productization");
const kitJsonPath = path.join(artifactsDir, "human-acceptance-reviewer-kit.json");
const kitMarkdownPath = path.join(artifactsDir, "human-acceptance-reviewer-kit.md");
const receiptPath = path.join(artifactsDir, "human-acceptance-reviewer-kit-verification.json");

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

function main() {
  const checks: VerificationCheck[] = [];
  const kit = readJson<{
    responseMode?: string;
    status?: string;
    canStartReviewerSession?: boolean;
    failedReasons?: string[];
    stableTaskId?: string;
    allSoftwareObjective?: string;
    releaseDecision?: string;
    reviewOnly?: boolean;
    accepted?: boolean;
    packagingGated?: boolean;
    canRelease?: boolean;
    canActivateRealModel?: boolean;
    reviewerSteps?: Array<{ id?: string; instruction?: string; expectedEvidence?: string; stopIf?: string }>;
    maintainerCommands?: string[];
    evidenceToReturn?: string[];
    sourceEvidence?: {
      humanAcceptancePreflight?: { status?: string; canStartHumanAcceptance?: boolean; passed?: number; total?: number };
      humanAcceptanceGate?: { status?: string; latestEvidenceKind?: string; latestHumanReviewed?: boolean };
      releaseReadiness?: { status?: string; releaseDecision?: string; blockerCount?: number };
      productSmoke?: { status?: string; passed?: number; total?: number };
      publicBetaReadiness?: { status?: string; betaCanStart?: boolean };
    };
    forbiddenOutcomes?: string[];
    locks?: {
      mustNotSaveAcceptanceFromKit?: boolean;
      mustNotEnableRules?: boolean;
      mustNotUnlockPackaging?: boolean;
      mustNotClaimReleaseReady?: boolean;
      mustNotAcceptRealModel?: boolean;
      mustNotResumeAllSoftwareObjective?: boolean;
    };
  }>(kitJsonPath);
  const markdown = fs.existsSync(kitMarkdownPath) ? fs.readFileSync(kitMarkdownPath, "utf8") : "";
  const packageJson = readRepoJson<{ scripts?: Record<string, string> }>("package.json");

  push(
    checks,
    "Reviewer kit JSON is ready",
    kit?.responseMode === "human_acceptance_reviewer_kit_json_v1" &&
      kit.status === "ready_for_reviewer" &&
      kit.canStartReviewerSession === true &&
      (kit.failedReasons?.length ?? -1) === 0,
    `status=${kit?.status ?? "missing"}; canStart=${kit?.canStartReviewerSession ?? "missing"}; failed=${
      kit?.failedReasons?.join(",") || "none"
    }`
  );

  push(
    checks,
    "Reviewer kit preserves all release locks",
    kit?.releaseDecision === "do_not_release" &&
      kit.reviewOnly === true &&
      kit.accepted === false &&
      kit.packagingGated === true &&
      kit.canRelease === false &&
      kit.canActivateRealModel === false &&
      kit.allSoftwareObjective === "paused" &&
      kit.locks?.mustNotSaveAcceptanceFromKit === true &&
      kit.locks.mustNotEnableRules === true &&
      kit.locks.mustNotUnlockPackaging === true &&
      kit.locks.mustNotClaimReleaseReady === true &&
      kit.locks.mustNotAcceptRealModel === true &&
      kit.locks.mustNotResumeAllSoftwareObjective === true,
    `release=${kit?.releaseDecision ?? "missing"}; accepted=${kit?.accepted ?? "missing"}; packagingGated=${
      kit?.packagingGated ?? "missing"
    }; canRelease=${kit?.canRelease ?? "missing"}; canActivateRealModel=${
      kit?.canActivateRealModel ?? "missing"
    }; allSoftware=${kit?.allSoftwareObjective ?? "missing"}`
  );

  push(
    checks,
    "Reviewer kit is backed by current preflight and release evidence",
    kit?.sourceEvidence?.humanAcceptancePreflight?.status === "passed" &&
      kit.sourceEvidence.humanAcceptancePreflight.canStartHumanAcceptance === true &&
      kit.sourceEvidence.humanAcceptancePreflight.passed === kit.sourceEvidence.humanAcceptancePreflight.total &&
      kit.sourceEvidence.releaseReadiness?.releaseDecision === "do_not_release" &&
      (kit.sourceEvidence.releaseReadiness?.blockerCount ?? 0) >= 1 &&
      kit.sourceEvidence.productSmoke?.status === "passed" &&
      kit.sourceEvidence.productSmoke.passed === kit.sourceEvidence.productSmoke.total,
    `preflight=${kit?.sourceEvidence?.humanAcceptancePreflight?.status ?? "missing"} ${
      kit?.sourceEvidence?.humanAcceptancePreflight?.passed ?? "?"
    }/${kit?.sourceEvidence?.humanAcceptancePreflight?.total ?? "?"}; release=${
      kit?.sourceEvidence?.releaseReadiness?.releaseDecision ?? "missing"
    }; smoke=${kit?.sourceEvidence?.productSmoke?.status ?? "missing"}`
  );

  push(
    checks,
    "Reviewer kit gives complete human acceptance instructions",
    kit?.stableTaskId === "task-photo-travel-journal" &&
      (kit.reviewerSteps?.length ?? 0) >= 6 &&
      kit.reviewerSteps?.some((step) => step.instruction?.includes("/manual-test")) === true &&
      kit.reviewerSteps.some((step) => step.instruction?.includes("/tasks/task-photo-travel-journal/run")) &&
      kit.reviewerSteps.some((step) => step.instruction?.includes("verify:human-acceptance")),
    `stableTask=${kit?.stableTaskId ?? "missing"}; reviewerSteps=${kit?.reviewerSteps?.length ?? 0}`
  );

  push(
    checks,
    "Reviewer kit asks for real returned evidence",
    kit?.evidenceToReturn?.some((item) => item.includes("manual-acceptance-latest.json")) === true &&
      kit.evidenceToReturn.some((item) => item.includes("verify:human-acceptance-receipt")) &&
      kit.evidenceToReturn.some((item) => item.includes("human-acceptance-gate.json")) &&
      markdown.includes("evidenceKind=human_review") &&
      markdown.includes("humanReviewed=true") &&
      markdown.includes("human-acceptance-receipt.template.json") &&
      markdown.includes("npm run verify:human-acceptance-receipt -- --receipt") &&
      markdown.includes("manual_test_workbench_human_review_evidence_v1"),
    `returnedEvidence=${kit?.evidenceToReturn?.length ?? 0}; markdownBytes=${fileSize(kitMarkdownPath)}`
  );

  push(
    checks,
    "Reviewer kit Markdown is actionable and explicit",
    markdown.includes("/manual-test") &&
      markdown.includes("/tasks/task-photo-travel-journal/run") &&
      markdown.includes("npm run preflight:human-acceptance") &&
      markdown.includes("npm run verify:human-acceptance") &&
      markdown.includes("do_not_release") &&
      markdown.includes("accepted=false") &&
      markdown.includes("packagingGated=true") &&
      markdown.includes("canRelease=false") &&
      markdown.includes("canActivateRealModel=false") &&
      fileSize(kitMarkdownPath) > 1000,
    `markdownBytes=${fileSize(kitMarkdownPath)}`
  );

  push(
    checks,
    "Reviewer kit package scripts are registered",
    packageJson?.scripts?.["build:human-acceptance-reviewer-kit"] ===
      "tsx scripts/build-human-acceptance-reviewer-kit.ts" &&
      packageJson.scripts?.["verify:human-acceptance-reviewer-kit"] ===
        "tsx scripts/verify-human-acceptance-reviewer-kit.ts" &&
      packageJson.scripts?.["build:human-acceptance-receipt-template"] ===
        "tsx scripts/build-human-acceptance-receipt-template.ts" &&
      packageJson.scripts?.["verify:human-acceptance-receipt"] ===
        "tsx scripts/verify-human-acceptance-receipt.ts",
    `buildScript=${packageJson?.scripts?.["build:human-acceptance-reviewer-kit"] ?? "missing"}; verifyScript=${
      packageJson?.scripts?.["verify:human-acceptance-reviewer-kit"] ?? "missing"
    }`
  );

  push(
    checks,
    "Reviewer kit does not claim forbidden outcomes",
    kit?.forbiddenOutcomes?.some((item) => item.includes("product acceptance")) === true &&
      kit.forbiddenOutcomes.some((item) => item.includes("release readiness")) &&
      !markdown.includes("releaseDecision=release_ready") &&
      !markdown.includes("accepted=true") &&
      !markdown.includes("packagingGated=false"),
    `forbiddenOutcomes=${kit?.forbiddenOutcomes?.length ?? 0}`
  );

  const passed = checks.filter((check) => check.pass).length;
  const verification = {
    responseMode: "human_acceptance_reviewer_kit_verification_json_v1",
    status: passed === checks.length ? "passed" : "failed",
    generatedAt: new Date().toISOString(),
    command: "npm run verify:human-acceptance-reviewer-kit",
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
        ? "Give human-acceptance-reviewer-kit.md to one real reviewer before saving human_review evidence."
        : "Fix the reviewer kit before asking for real human acceptance."
  };

  fs.mkdirSync(artifactsDir, { recursive: true });
  fs.writeFileSync(receiptPath, JSON.stringify(verification, null, 2));
  console.log(JSON.stringify(verification, null, 2));
  console.log(`\nHuman acceptance reviewer kit verification written to ${receiptPath}`);

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
