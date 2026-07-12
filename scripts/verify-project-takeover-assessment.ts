import fs from "node:fs";
import path from "node:path";

type VerificationCheck = {
  name: string;
  pass: boolean;
  evidence: string;
};

const rootDir = process.cwd();
const artifactsDir = path.join(rootDir, "artifacts", "productization");
const receiptPath = path.join(artifactsDir, "project-takeover-assessment-verification.json");
const assessmentPath = path.join(rootDir, "PROJECT_TAKEOVER_ASSESSMENT.md");

function push(checks: VerificationCheck[], name: string, pass: boolean, evidence: string) {
  checks.push({ name, pass, evidence });
}

function readText(relativePath: string) {
  const fullPath = path.join(rootDir, relativePath);
  if (!fs.existsSync(fullPath)) return "";
  return fs.readFileSync(fullPath, "utf8");
}

function readJson<T>(relativePath: string): T | null {
  const fullPath = path.join(rootDir, relativePath);
  if (!fs.existsSync(fullPath)) return null;
  return JSON.parse(fs.readFileSync(fullPath, "utf8")) as T;
}

function statusLine(value?: { status?: string; passed?: number; total?: number } | null) {
  return `${value?.status ?? "missing"} ${value?.passed ?? "?"}/${value?.total ?? "?"}`;
}

function firstIndex(text: string, needles: string[]) {
  const indexes = needles.map((needle) => text.indexOf(needle)).filter((index) => index >= 0);
  return indexes.length > 0 ? Math.min(...indexes) : -1;
}

function before(text: string, first: string[], second: string[]) {
  const firstAt = firstIndex(text, first);
  const secondAt = firstIndex(text, second);
  return firstAt >= 0 && secondAt >= 0 && firstAt < secondAt;
}

function main() {
  const checks: VerificationCheck[] = [];
  const assessment = fs.existsSync(assessmentPath) ? fs.readFileSync(assessmentPath, "utf8") : "";
  const packageJson = readJson<{ scripts?: Record<string, string> }>("package.json");
  const localCi = readJson<{ status?: string; passed?: number; total?: number; releaseDecision?: string; allSoftwareObjective?: string }>(
    "artifacts/productization/productization-ci-local.json"
  );
  const localCiVerification = readJson<{
    status?: string;
    passed?: number;
    total?: number;
    releaseDecision?: string;
    allSoftwareObjective?: string;
    accepted?: boolean;
    packagingGated?: boolean;
    canRelease?: boolean;
    canActivateRealModel?: boolean;
  }>("artifacts/productization/productization-ci-local-verification.json");
  const sourceVerification = readJson<{
    status?: string;
    passed?: number;
    total?: number;
    archivePath?: string;
    archiveSha256?: string;
    releaseDecision?: string;
    allSoftwareObjective?: string;
    uploadReady?: boolean;
    includesSecrets?: boolean;
    includesDependencies?: boolean;
    includesLocalDatabase?: boolean;
    includesBuildCache?: boolean;
  }>("artifacts/github-source-package/github-source-package-verification.json");
  const deliveryVerification = readJson<{
    status?: string;
    passed?: number;
    total?: number;
    releaseDecision?: string;
    allSoftwareObjective?: string;
    accepted?: boolean;
    packagingGated?: boolean;
    canRelease?: boolean;
    canActivateRealModel?: boolean;
  }>("artifacts/productization/product-delivery-index-verification.json");
  const deliveryIndex = readJson<{
    status?: string;
    finalArchive?: { path?: string; sha256?: string; verification?: string; uploadReady?: boolean };
  }>("artifacts/productization/product-delivery-index.json");
  const publicBeta = readJson<{ status?: string; passed?: number; total?: number; betaCanStart?: boolean }>(
    "artifacts/productization/public-beta-readiness.json"
  );
  const firstRealLaunch = readJson<{ status?: string; readyToLaunch?: boolean; releaseDecision?: string }>(
    "artifacts/productization/first-real-tester-launch.json"
  );
  const finalGoNoGo = readJson<{ status?: string; manualSendAllowed?: boolean; actualSendPerformed?: boolean }>(
    "artifacts/productization/first-real-tester-final-go-no-go.json"
  );
  const releaseReadiness = readJson<{ status?: string; releaseDecision?: string; accepted?: boolean; packagingGated?: boolean }>(
    "artifacts/productization/product-release-readiness.json"
  );

  push(
    checks,
    "Takeover assessment exists and is current productization-oriented",
    assessment.includes("Date: 2026-06-26") &&
      assessment.includes("bounded productization track") &&
      assessment.includes("Bounded core teaching-loop productization candidate") &&
      assessment.includes("Ready for one controlled human/beta pass, not production release."),
    `bytes=${assessment.length}; date=${assessment.includes("Date: 2026-06-26")}`
  );

  push(
    checks,
    "Assessment preserves paused all-software and not-release boundary",
    assessment.includes("all-software objective is paused") &&
      assessment.includes("allSoftwareObjective=paused") &&
      assessment.includes("releaseDecision=do_not_release") &&
      assessment.includes("accepted=false") &&
      assessment.includes("packagingGated=true") &&
      assessment.includes("canRelease=false") &&
      assessment.includes("canActivateRealModel=false") &&
      assessment.includes("not ready for production release"),
    `release=${assessment.includes("releaseDecision=do_not_release")}; allSoftware=${assessment.includes("allSoftwareObjective=paused")}`
  );

  const hardCodedArchiveMatches = Array.from(
    assessment.matchAll(/transparent-ai-apprentice-mcp-github-source-\d{4}-\d{2}-\d{2}T[0-9-]+Z\.zip/g)
  ).map((match) => match[0]);
  const hardCodedShaMatches = Array.from(assessment.matchAll(/sha256:\s*[0-9a-f]{64}/gi)).map((match) => match[0]);
  push(
    checks,
    "Assessment does not hard-code a self-staling source archive or SHA",
    hardCodedArchiveMatches.length === 0 &&
      hardCodedShaMatches.length === 0 &&
      assessment.includes("product-delivery-index.json") &&
      assessment.includes("self-staling zip filename or SHA"),
    `archives=${hardCodedArchiveMatches.length}; shaLines=${hardCodedShaMatches.length}; deliveryIndex=${assessment.includes(
      "product-delivery-index.json"
    )}`
  );

  push(
    checks,
    "Assessment evidence summary matches current green receipts",
    localCi?.status === "passed" &&
      localCi.passed === 3 &&
      localCi.total === 3 &&
      localCiVerification?.status === "passed" &&
      localCiVerification.passed === 8 &&
      localCiVerification.total === 8 &&
      sourceVerification?.status === "passed" &&
      sourceVerification.passed === 48 &&
      sourceVerification.total === 48 &&
      deliveryVerification?.status === "passed" &&
      deliveryVerification.passed === 14 &&
      deliveryVerification.total === 14 &&
      publicBeta?.status === "passed" &&
      publicBeta.passed === 60 &&
      publicBeta.total === 60 &&
      publicBeta.betaCanStart === true,
    `ci=${statusLine(localCi)}; ciVerify=${statusLine(localCiVerification)}; source=${statusLine(sourceVerification)}; delivery=${statusLine(
      deliveryVerification
    )}; beta=${statusLine(publicBeta)}; betaCanStart=${publicBeta?.betaCanStart ?? "missing"}`
  );

  push(
    checks,
    "Assessment is backed by a verified delivery index instead of local git",
    deliveryIndex?.status === "ready_for_handoff" &&
      deliveryIndex.finalArchive?.path === sourceVerification?.archivePath &&
      deliveryIndex.finalArchive?.sha256 === sourceVerification?.archiveSha256 &&
      deliveryIndex.finalArchive?.verification === "passed 48/48" &&
      deliveryIndex.finalArchive?.uploadReady === true &&
      assessment.includes("The local root `.git` directory is not valid") &&
      assessment.includes("source archive named by the product delivery index"),
    `delivery=${deliveryIndex?.status ?? "missing"}; archive=${deliveryIndex?.finalArchive?.path ?? "missing"}; shaMatch=${
      deliveryIndex?.finalArchive?.sha256 === sourceVerification?.archiveSha256
    }`
  );

  push(
    checks,
    "Assessment exposes the first controlled human pass but not widening",
    firstRealLaunch?.status === "ready_to_invite_one_bounded_real_tester_or_reviewer" &&
      firstRealLaunch.readyToLaunch === true &&
      finalGoNoGo?.status === "ready_for_one_manual_send" &&
      finalGoNoGo.manualSendAllowed === true &&
      finalGoNoGo.actualSendPerformed === false &&
      assessment.includes("exactly one bounded beta tester") &&
      assessment.includes("one real human acceptance reviewer") &&
      assessment.includes("Do not invite a second tester or reviewer until the first return has been processed"),
    `launch=${firstRealLaunch?.status ?? "missing"}; ready=${firstRealLaunch?.readyToLaunch ?? "missing"}; final=${finalGoNoGo?.status ?? "missing"}; sent=${finalGoNoGo?.actualSendPerformed ?? "missing"}`
  );

  push(
    checks,
    "Assessment keeps release blockers explicit",
    releaseReadiness?.status === "blocked_not_release_ready" &&
      releaseReadiness.releaseDecision === "do_not_release" &&
      releaseReadiness.accepted === false &&
      releaseReadiness.packagingGated === true &&
      assessment.includes("Real human acceptance is not complete") &&
      assessment.includes("Real model acceptance is not complete") &&
      assessment.includes("Release and packaging approval are still locked"),
    `release=${releaseReadiness?.status ?? "missing"}; decision=${releaseReadiness?.releaseDecision ?? "missing"}`
  );

  push(
    checks,
    "Assessment first-read order starts with delivery index and takeover flow",
    before(assessment, ["product-delivery-index.md"], ["product-takeover-decision-matrix.md"]) &&
      before(assessment, ["product-takeover-decision-matrix.md"], ["productization-launch-checklist.md"]) &&
      before(assessment, ["productization-launch-checklist.md"], ["first-real-tester-launch.md"]) &&
      before(assessment, ["first-real-tester-launch.md"], ["first-real-tester-return-gate.md"]) &&
      before(assessment, ["first-real-tester-return-gate.md"], ["product-status-summary.md"]),
    `deliveryBeforeTakeover=${before(assessment, ["product-delivery-index.md"], ["product-takeover-decision-matrix.md"])}; returnGateBeforeSummary=${before(
      assessment,
      ["first-real-tester-return-gate.md"],
      ["product-status-summary.md"]
    )}`
  );

  push(
    checks,
    "Assessment verifier is registered in package scripts and productization gates",
    packageJson?.scripts?.["verify:project-takeover-assessment"] === "tsx scripts/verify-project-takeover-assessment.ts" &&
      packageJson.scripts?.["ci:productization:gates"]?.includes("npm run verify:project-takeover-assessment") === true,
    `script=${packageJson?.scripts?.["verify:project-takeover-assessment"] ?? "missing"}; gates=${
      packageJson?.scripts?.["ci:productization:gates"]?.includes("npm run verify:project-takeover-assessment") ?? false
    }`
  );

  const passed = checks.filter((check) => check.pass).length;
  const receipt = {
    responseMode: "project_takeover_assessment_verification_json_v1",
    status: passed === checks.length ? "passed" : "failed",
    generatedAt: new Date().toISOString(),
    command: "npm run verify:project-takeover-assessment",
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
        ? "Use PROJECT_TAKEOVER_ASSESSMENT.md as the plain-language takeover companion to product-delivery-index.md."
        : "Fix PROJECT_TAKEOVER_ASSESSMENT.md so it matches current productization evidence without hard-coding self-staling archive identifiers."
  };

  fs.mkdirSync(artifactsDir, { recursive: true });
  fs.writeFileSync(receiptPath, JSON.stringify(receipt, null, 2));
  console.log(JSON.stringify(receipt, null, 2));
  console.log(`\nProject takeover assessment verification written to ${receiptPath}`);

  if (receipt.status !== "passed") process.exit(1);
}

main();
