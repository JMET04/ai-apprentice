import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

type VerificationCheck = {
  name: string;
  pass: boolean;
  evidence: string;
};

const rootDir = process.cwd();
const outputDir = path.join(rootDir, "artifacts", "github-source-package");
const manifestPath = path.join(outputDir, "github-source-package-manifest.json");
const receiptPath = path.join(outputDir, "github-source-package-verification.json");
const extractDir = path.join(outputDir, "github-source-package-verify-extract");
const productizationWorkflowRelativePath = path.join(".github", "workflows", "productization-ci.yml");

function timestampMs(value: string | undefined) {
  const parsed = Date.parse(value ?? "");
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function push(checks: VerificationCheck[], name: string, pass: boolean, evidence: string) {
  checks.push({ name, pass, evidence });
}

function readTextFile(fullPath: string) {
  try {
    return fs.readFileSync(fullPath, "utf8");
  } catch {
    return "";
  }
}

function scriptHasProductizationGates(script: string | undefined) {
  const text = script ?? "";
  return (
    text.includes("npm run typecheck") &&
    text.includes("npm run test") &&
    text.includes("npm run preflight:human-acceptance -- --base-url http://127.0.0.1:3000") &&
    text.includes("npm run build:human-acceptance-reviewer-invite") &&
    text.includes("npm run verify:human-acceptance-reviewer-invite") &&
    text.includes("npm run build:productization-launch-checklist") &&
    text.includes("npm run verify:productization-launch-checklist") &&
    text.includes("npm run build:product-status-summary") &&
    text.includes("npm run verify:product-status-summary") &&
    text.includes("npm run build:product-takeover-matrix") &&
    text.includes("npm run verify:product-takeover-matrix") &&
    text.includes("npm run verify:product-takeover-entry") &&
    text.includes("npm run verify:project-takeover-assessment") &&
    text.includes("npm run verify:real-model-adapter-contract") &&
    text.includes("npm run build:real-model-trial-kit") &&
    text.includes("npm run verify:real-model-trial-kit") &&
    text.includes("npm run build:real-model-trial-receipt-template") &&
    text.includes("npm run verify:real-model-trial-receipt") &&
    text.includes("npm run verify:real-model-trial-return-intake") &&
    text.includes("npm run verify:productization-evidence-freshness") &&
    text.includes("npm run harden:productization-locks") &&
    text.includes("npm run audit:productization-lock-coverage") &&
    text.includes("npm run build:first-real-tester-launch") &&
    text.includes("npm run verify:first-real-tester-launch") &&
    text.includes("npm run build:first-real-tester-contact-readiness") &&
    text.includes("npm run verify:first-real-tester-contact-readiness") &&
    text.includes("npm run build:first-real-tester-send-execution-brief") &&
    text.includes("npm run verify:first-real-tester-send-execution-brief") &&
    text.includes("npm run build:first-real-tester-send-receipt-template") &&
    text.includes("npm run verify:first-real-tester-send-receipt-template") &&
    text.includes("npm run build:first-real-tester-final-go-no-go") &&
    text.includes("npm run verify:first-real-tester-final-go-no-go") &&
    text.includes("npm run package:product-trial") &&
    text.includes("npm run verify:product-trial") &&
    text.includes("npm run preflight:public-beta-tester -- --base-url http://127.0.0.1:3000") &&
    text.includes("npm run package:public-beta") &&
    text.includes("npm run verify:public-beta") &&
    text.includes("npm run package:github-source") === false &&
    text.includes("npm run verify:github-source") === false &&
    text.includes("AI_PROVIDER") === false
  );
}

function productizationCiUsesSelfVerifiedPreflightOrder(script: string | undefined) {
  const text = script ?? "";
  return (
    text.includes(
      "npm run verify:human-acceptance-return-intake && npm run verify:real-model-trial-return-intake && npm run verify:product-release-readiness -- --allow-blocked && npm run preflight:human-acceptance -- --base-url http://127.0.0.1:3000"
    ) &&
    text.includes(
      "npm run verify:product-release-blocker-board && npm run verify:real-model-adapter-contract && npm run build:real-model-trial-kit && npm run verify:real-model-trial-kit && npm run build:real-model-trial-receipt-template && npm run verify:real-model-trial-receipt && npm run build:product-operator-brief"
    ) &&
    text.includes(
      "npm run preflight:public-beta-tester -- --base-url http://127.0.0.1:3000 && npm run package:product-trial && npm run verify:product-trial && npm run package:public-beta && npm run verify:public-beta"
    ) &&
    text.includes("npm run package:public-beta && npm run verify:product-trial") === false
  );
}
function workflowHasProductizationGates(text: string) {
  return (
    text.includes("npm run ci:productization:gates") &&
    text.includes("npm run build") &&
    text.includes("npm.cmd") &&
    text.includes("start:product") &&
    text.includes("127.0.0.1") &&
    text.includes("3000") &&
    text.includes("Invoke-RestMethod") &&
    text.includes("http://127.0.0.1:3000/api/health") &&
    text.includes("product_health_json_v1") &&
    text.includes("Product runtime did not become healthy before productization gates") &&
    text.includes("AI_PROVIDER") === false
  );
}
function phraseOrder(text: string, first: string, second: string) {
  const firstIndex = text.indexOf(first);
  const secondIndex = text.indexOf(second);
  return firstIndex >= 0 && secondIndex >= 0 && firstIndex < secondIndex;
}

function numberedListIsSequential(text: string, heading: string, nextHeading: string, expectedCount: number) {
  const start = text.indexOf(heading);
  if (start < 0) return false;
  const end = text.indexOf(nextHeading, start + heading.length);
  if (end < 0) return false;
  const section = text.slice(start, end);
  const numbers = Array.from(section.matchAll(/^(\d+)\.\s+/gm)).map((match) => Number(match[1]));
  return numbers.length === expectedCount && numbers.every((number, index) => number === index + 1);
}
function readJsonFile<T>(fullPath: string): T | null {
  try {
    return JSON.parse(fs.readFileSync(fullPath, "utf8")) as T;
  } catch {
    return null;
  }
}

function fileExistsWithSize(fullPath: string, minimumBytes = 1) {
  return fs.existsSync(fullPath) && fs.statSync(fullPath).size >= minimumBytes;
}

function sha256File(targetPath: string) {
  return createHash("sha256").update(fs.readFileSync(targetPath)).digest("hex");
}

function relativeToRoot(fullPath: string) {
  return path.relative(rootDir, fullPath).replaceAll("\\", "/");
}

function listFiles(targetDir: string): string[] {
  const files: string[] = [];
  if (!fs.existsSync(targetDir)) return files;

  function walk(current: string) {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const fullPath = path.join(current, entry.name);
      const relative = path.relative(targetDir, fullPath).replaceAll("\\", "/");
      files.push(relative);
      if (entry.isDirectory()) walk(fullPath);
    }
  }

  walk(targetDir);
  return files;
}

function hasForbiddenPayload(files: string[]) {
  const forbiddenSegments = new Set([".git", ".next", "node_modules", "coverage", "dist"]);
  const forbiddenExact = new Set([
    ".env",
    "dev.db",
    "dev.db-journal",
    "prisma/dev.db",
    "prisma/dev.db-journal",
    "tsconfig.tsbuildinfo",
    "tsconfig.typecheck.tsbuildinfo"
  ]);
  const forbiddenNamePatterns = [/^\.next-dev-.*\.log$/, /^\.product-.*\.log$/, /^\.qa-.*\.png$/];

  return files.filter((file) => {
    const parts = file.split("/");
    const basename = parts.at(-1) ?? file;
    return (
      forbiddenExact.has(file) ||
      forbiddenExact.has(basename) ||
      parts.some((part) => forbiddenSegments.has(part)) ||
      forbiddenNamePatterns.some((pattern) => pattern.test(basename))
    );
  });
}

function extractArchive(archivePath: string) {
  fs.rmSync(extractDir, { recursive: true, force: true });
  fs.mkdirSync(extractDir, { recursive: true });

  const result = spawnSync(
    "powershell",
    [
      "-NoProfile",
      "-ExecutionPolicy",
      "Bypass",
      "-Command",
      "Expand-Archive -LiteralPath $env:ARCHIVE_PATH -DestinationPath $env:EXTRACT_DIR -Force"
    ],
    {
      cwd: rootDir,
      env: {
        ...process.env,
        ARCHIVE_PATH: archivePath,
        EXTRACT_DIR: extractDir
      },
      encoding: "utf8"
    }
  );

  return {
    ok: result.status === 0,
    output: `${result.stdout ?? ""}${result.stderr ?? ""}`.trim()
  };
}

function main() {
  const checks: VerificationCheck[] = [];
  const manifest = readJsonFile<{
    responseMode?: string;
    status?: string;
    generatedAt?: string;
    archivePath?: string;
    stagingDir?: string;
    archiveBytes?: number;
    archiveSha256?: string;
    packageBoundary?: {
      uploadReady?: boolean;
      includesSecrets?: boolean;
      includesDependencies?: boolean;
      includesLocalDatabase?: boolean;
      includesBuildCache?: boolean;
    };
    publicBeta?: {
      status?: string;
      betaCanStart?: boolean;
      requiredPassed?: number;
      requiredTotal?: number;
      releaseDecision?: string;
      allSoftwareObjective?: string;
    };
    publicBetaPreparation?: {
      status?: string;
      passed?: number;
      total?: number;
      releaseDecision?: string;
      accepted?: boolean;
      packagingGated?: boolean;
      compactReceipt?: boolean;
      pathSanitized?: boolean;
    };
    publicBetaTesterInvite?: {
      status?: string;
      canInvite?: boolean;
      failedReasonCount?: number;
      releaseDecision?: string;
      accepted?: boolean;
      packagingGated?: boolean;
      betaPacketIncludesTesterRunbook?: boolean;
      testerSessionPreflightStatus?: string;
      testerSessionPreflightCanInvite?: boolean;
      testerSessionPreflightPassed?: number;
      testerSessionPreflightTotal?: number;
      testerSessionPreflightFreshEnough?: boolean;
      betaPacketIncludesTesterSessionPreflight?: boolean;
    };
    newRepositoryBootstrap?: {
      status?: string;
      passed?: number;
      total?: number;
      releaseDecision?: string;
      allSoftwareObjective?: string;
      accepted?: boolean;
      packagingGated?: boolean;
      canRelease?: boolean;
      canActivateRealModel?: boolean;
      evidencePath?: string;
    };
    copiedEvidence?: Array<{ source?: string; destination?: string; required?: boolean; bytes?: number }>;
    generatedEvidence?: Array<{ source?: string; destination?: string; required?: boolean; bytes?: number }>;
    copiedTopLevel?: Array<{ source?: string; destination?: string; required?: boolean; bytes?: number }>;
    uploadChecklist?: string[];
  }>(manifestPath);

  const archivePath = manifest?.archivePath ? path.join(rootDir, manifest.archivePath) : "";
  const stagingDir = manifest?.stagingDir ? path.join(rootDir, manifest.stagingDir) : "";
  const archiveBytes = fileExistsWithSize(archivePath) ? fs.statSync(archivePath).size : 0;
  const archiveSha256 = fileExistsWithSize(archivePath) ? sha256File(archivePath) : "";

  push(
    checks,
    "GitHub source package manifest exists",
    manifest?.responseMode === "github_source_package_manifest_json_v1" &&
      manifest.status === "built" &&
      fileExistsWithSize(manifestPath, 1000),
    `status=${manifest?.status ?? "missing"}; manifest=${relativeToRoot(manifestPath)}`
  );

  push(
    checks,
    "Archive exists and matches manifest size and sha256",
    fileExistsWithSize(archivePath, 1_000_000) &&
      archiveBytes === manifest?.archiveBytes &&
      /^[a-f0-9]{64}$/.test(manifest?.archiveSha256 ?? "") &&
      archiveSha256 === manifest?.archiveSha256,
    `archive=${manifest?.archivePath ?? "missing"}; bytes=${archiveBytes}; manifestBytes=${
      manifest?.archiveBytes ?? "missing"
    }; sha256=${archiveSha256 || "missing"}; manifestSha256=${manifest?.archiveSha256 ?? "missing"}`
  );

  push(
    checks,
    "Package boundary excludes local-only payloads",
    manifest?.packageBoundary?.uploadReady === true &&
      manifest.packageBoundary.includesSecrets === false &&
      manifest.packageBoundary.includesDependencies === false &&
      manifest.packageBoundary.includesLocalDatabase === false &&
      manifest.packageBoundary.includesBuildCache === false,
    `uploadReady=${manifest?.packageBoundary?.uploadReady ?? "missing"}; secrets=${
      manifest?.packageBoundary?.includesSecrets ?? "missing"
    }; dependencies=${manifest?.packageBoundary?.includesDependencies ?? "missing"}; db=${
      manifest?.packageBoundary?.includesLocalDatabase ?? "missing"
    }; buildCache=${manifest?.packageBoundary?.includesBuildCache ?? "missing"}`
  );
  push(
    checks,
    "Package manifest declares Productization CI workflow",
    manifest?.copiedTopLevel?.some((item) => item.destination === ".github" && Number(item.bytes ?? 0) >= 500) === true,
    `topLevel=${manifest?.copiedTopLevel?.some((item) => item.destination === ".github") ?? false}; bytes=${
      manifest?.copiedTopLevel?.find((item) => item.destination === ".github")?.bytes ?? "missing"
    }`
  );

  push(
    checks,
    "Public beta state is ready but release remains locked",
    manifest?.publicBeta?.status === "ready_for_public_beta" &&
      manifest.publicBeta.betaCanStart === true &&
      manifest.publicBeta.requiredPassed === manifest.publicBeta.requiredTotal &&
      Number(manifest.publicBeta.requiredTotal ?? 0) >= 29 &&
      manifest.publicBeta.releaseDecision === "do_not_release" &&
      manifest.publicBeta.allSoftwareObjective === "paused",
    `beta=${manifest?.publicBeta?.status ?? "missing"}; required=${
      manifest?.publicBeta?.requiredPassed ?? "?"
    }/${manifest?.publicBeta?.requiredTotal ?? "?"}; release=${
      manifest?.publicBeta?.releaseDecision ?? "missing"
    }; allSoftware=${manifest?.publicBeta?.allSoftwareObjective ?? "missing"}`
  );

  push(
    checks,
    "Tester invite and beta preparation evidence remain review-only",
    manifest?.publicBetaPreparation?.status === "passed" &&
      manifest.publicBetaPreparation.passed === manifest.publicBetaPreparation.total &&
      manifest.publicBetaPreparation.releaseDecision === "do_not_release" &&
      manifest.publicBetaPreparation.accepted === false &&
      manifest.publicBetaPreparation.packagingGated === true &&
      manifest.publicBetaPreparation.compactReceipt === true &&
      manifest.publicBetaPreparation.pathSanitized === true &&
      manifest.publicBetaTesterInvite?.status === "ready_to_invite" &&
      manifest.publicBetaTesterInvite.canInvite === true &&
      manifest.publicBetaTesterInvite.failedReasonCount === 0 &&
      manifest.publicBetaTesterInvite.releaseDecision === "do_not_release" &&
      manifest.publicBetaTesterInvite.accepted === false &&
      manifest.publicBetaTesterInvite.packagingGated === true &&
      manifest.publicBetaTesterInvite.betaPacketIncludesTesterRunbook === true,
    `preparation=${manifest?.publicBetaPreparation?.status ?? "missing"} ${
      manifest?.publicBetaPreparation?.passed ?? "?"
    }/${manifest?.publicBetaPreparation?.total ?? "?"}; invite=${
      manifest?.publicBetaTesterInvite?.status ?? "missing"
    }; canInvite=${manifest?.publicBetaTesterInvite?.canInvite ?? "missing"}`
  );

  push(
    checks,
    "Tester launch preflight packaging matches freshness for handoff",
    manifest?.publicBetaTesterInvite?.testerSessionPreflightStatus === "passed" &&
      manifest.publicBetaTesterInvite.testerSessionPreflightCanInvite === true &&
      manifest.publicBetaTesterInvite.testerSessionPreflightPassed === manifest.publicBetaTesterInvite.testerSessionPreflightTotal &&
      Number(manifest.publicBetaTesterInvite.testerSessionPreflightTotal ?? 0) >= 10 &&
      ((manifest.publicBetaTesterInvite.testerSessionPreflightFreshEnough === true &&
        manifest.publicBetaTesterInvite.betaPacketIncludesTesterSessionPreflight === true) ||
        (manifest.publicBetaTesterInvite.testerSessionPreflightFreshEnough === false &&
          manifest.publicBetaTesterInvite.betaPacketIncludesTesterSessionPreflight === false)),
    `status=${manifest?.publicBetaTesterInvite?.testerSessionPreflightStatus ?? "missing"}; checks=${
      manifest?.publicBetaTesterInvite?.testerSessionPreflightPassed ?? "?"
    }/${manifest?.publicBetaTesterInvite?.testerSessionPreflightTotal ?? "?"}; canInvite=${
      manifest?.publicBetaTesterInvite?.testerSessionPreflightCanInvite ?? "missing"
    }; freshEnough=${manifest?.publicBetaTesterInvite?.testerSessionPreflightFreshEnough ?? "missing"}; packaged=${
      manifest?.publicBetaTesterInvite?.betaPacketIncludesTesterSessionPreflight ?? "missing"
    }`
  );
  const copiedDestinations = new Set([
    ...(manifest?.copiedEvidence ?? []),
    ...(manifest?.generatedEvidence ?? [])
  ].map((item) => item.destination));
  const requiredEvidence = [
    "artifacts/productization/public-beta-packet",
    "artifacts/productization/product-trial-packet",
    "artifacts/productization/product-trial-packet-verification.json",
    "artifacts/productization/productization-evidence-freshness.json",
    "artifacts/productization/productization-lock-hardening.json",
    "artifacts/productization/productization-lock-hardening.md",
    "artifacts/productization/productization-lock-coverage-audit.json",
    "artifacts/productization/productization-lock-coverage-audit.md",
    "artifacts/productization/first-real-tester-launch.json",
    "artifacts/productization/first-real-tester-launch.md",
    "artifacts/productization/first-real-tester-launch-verification.json",
    "artifacts/productization/first-real-tester-dispatch-packet",
    "artifacts/productization/first-real-tester-dispatch-packet.json",
    "artifacts/productization/first-real-tester-dispatch-packet.md",
    "artifacts/productization/first-real-tester-dispatch-packet-verification.json",
    "artifacts/productization/first-real-tester-send-bundle",
    "artifacts/productization/first-real-tester-send-bundle.json",
    "artifacts/productization/first-real-tester-send-bundle.md",
    "artifacts/productization/first-real-tester-send-bundle-verification.json",
    "artifacts/productization/first-real-tester-contact-readiness.json",
    "artifacts/productization/first-real-tester-contact-readiness.md",
    "artifacts/productization/first-real-tester-contact-readiness-verification.json",
    "artifacts/productization/first-real-tester-send-execution-brief.json",
    "artifacts/productization/first-real-tester-send-execution-brief.md",
    "artifacts/productization/first-real-tester-send-execution-brief-verification.json",
    "artifacts/productization/first-real-tester-send-receipt.template.json",
    "artifacts/productization/first-real-tester-send-receipt-template.md",
    "artifacts/productization/first-real-tester-send-receipt-template-verification.json",
    "artifacts/productization/first-real-tester-final-go-no-go.json",
    "artifacts/productization/first-real-tester-final-go-no-go.md",
    "artifacts/productization/first-real-tester-final-go-no-go-verification.json",
    "artifacts/productization/first-real-tester-return-workbench.json",
    "artifacts/productization/first-real-tester-return-workbench.md",
    "artifacts/productization/first-real-tester-return-workbench-verification.json",
    "artifacts/productization/first-real-tester-return-gate.json",
    "artifacts/productization/first-real-tester-return-gate.md",
    "artifacts/productization/first-real-tester-return-gate-verification.json",
    "artifacts/productization/product-status-summary.json",
    "artifacts/productization/product-status-summary-verification.json",
    "artifacts/productization/product-status-summary.md",
    "artifacts/productization/product-takeover-decision-matrix.json",
    "artifacts/productization/product-takeover-decision-matrix-verification.json",
    "artifacts/productization/product-takeover-decision-matrix.md",
    "artifacts/productization/product-takeover-entry-consistency.json",
    "artifacts/productization/project-takeover-assessment-verification.json",
    "artifacts/productization/new-repository-bootstrap-verification.json",
    "artifacts/productization/productization-launch-checklist.json",
    "artifacts/productization/productization-launch-checklist-verification.json",
    "artifacts/productization/productization-launch-checklist.md",
    "artifacts/productization/product-operator-brief.json",
    "artifacts/productization/product-operator-brief-verification.json",
    "artifacts/productization/product-operator-brief.md",
    "artifacts/productization/public-beta-readiness.json",
    "artifacts/productization/human-acceptance-gate.json",
    "artifacts/productization/human-acceptance-reviewer-invite.json",
    "artifacts/productization/human-acceptance-reviewer-invite-verification.json",
    "artifacts/productization/human-acceptance-reviewer-invite.md",
    "artifacts/productization/real-model-adapter-contract-verification.json"
  ];
  const missingEvidence = requiredEvidence.filter((item) => !copiedDestinations.has(item));
  push(
    checks,
    "Key productization evidence is declared for upload",
    missingEvidence.length === 0,
    `missing=${missingEvidence.join(",") || "none"}`
  );

  const rootWorkflowPath = path.join(rootDir, productizationWorkflowRelativePath);
  const stagingWorkflowPath = path.join(stagingDir, productizationWorkflowRelativePath);
  const rootWorkflow = readTextFile(rootWorkflowPath);
  const stagingWorkflow = readTextFile(stagingWorkflowPath);

  const stagingFiles = listFiles(stagingDir);
  const stagingViolations = hasForbiddenPayload(stagingFiles);
  push(
    checks,
    "Staging directory has no forbidden payload",
    fs.existsSync(stagingDir) && stagingViolations.length === 0,
    `files=${stagingFiles.length}; violations=${stagingViolations.slice(0, 5).join(",") || "none"}`
  );
  push(
    checks,
    "Productization CI workflow is staged for upload",
    fileExistsWithSize(rootWorkflowPath, 500) &&
      fileExistsWithSize(stagingWorkflowPath, 500) &&
      workflowHasProductizationGates(rootWorkflow) &&
      workflowHasProductizationGates(stagingWorkflow),
    `root=${fileExistsWithSize(rootWorkflowPath, 500)}; staged=${fileExistsWithSize(
      stagingWorkflowPath,
      500
    )}; rootGates=${workflowHasProductizationGates(rootWorkflow)}; stagedGates=${workflowHasProductizationGates(
      stagingWorkflow
    )}`
  );

  const extract = extractArchive(archivePath);
  const extractedFiles = listFiles(extractDir);
  const extractedViolations = hasForbiddenPayload(extractedFiles);
  const extractedBootstrap = spawnSync(process.execPath, [path.join(extractDir, "scripts", "verify-new-repository-bootstrap.mjs"), "--root", extractDir, "--json-only"], {
    cwd: extractDir,
    encoding: "utf8"
  });
  const extractedBootstrapReceipt = (() => {
    try {
      return JSON.parse(extractedBootstrap.stdout || "null") as {
        responseMode?: string;
        status?: string;
        releaseDecision?: string;
        allSoftwareObjective?: string;
        accepted?: boolean;
        packagingGated?: boolean;
        canRelease?: boolean;
        canActivateRealModel?: boolean;
        passed?: number;
        total?: number;
      } | null;
    } catch {
      return null;
    }
  })();
  const extractedPackagedBootstrapReceipt = readJsonFile<{
    responseMode?: string;
    status?: string;
    releaseDecision?: string;
    allSoftwareObjective?: string;
    accepted?: boolean;
    packagingGated?: boolean;
    canRelease?: boolean;
    canActivateRealModel?: boolean;
    passed?: number;
    total?: number;
  }>(path.join(extractDir, "artifacts", "productization", "new-repository-bootstrap-verification.json"));
  const extractedPackageJson = readJsonFile<{ scripts?: Record<string, string>; engines?: { node?: string; npm?: string }; packageManager?: string }>(path.join(extractDir, "package.json"));
  const extractedStatusSummary = readJsonFile<{
    responseMode?: string;
    status?: string;
    betaCanStart?: boolean;
    canRelease?: boolean;
    canActivateRealModel?: boolean;
    accepted?: boolean;
    packagingGated?: boolean;
    releaseDecision?: string;
    allSoftwareObjective?: string;
  }>(path.join(extractDir, "artifacts", "productization", "product-status-summary.json"));
  const extractedTakeoverMatrix = readJsonFile<{
    responseMode?: string;
    status?: string;
    releaseDecision?: string;
    allSoftwareObjective?: string;
    reviewOnly?: boolean;
    accepted?: boolean;
    packagingGated?: boolean;
    canRelease?: boolean;
    canActivateRealModel?: boolean;
    allowedActions?: Array<{ id?: string; allowed?: boolean; evidencePath?: string; redactionChecklistPath?: string; stopCondition?: string }>;
    blockedActions?: Array<{ id?: string; blocked?: boolean }>;
  }>(path.join(extractDir, "artifacts", "productization", "product-takeover-decision-matrix.json"));
  const extractedTakeoverEntryConsistency = readJsonFile<{
    responseMode?: string;
    status?: string;
    generatedAt?: string;
    checkedTargets?: string[];
    skippedStaleOptionalTargets?: string[];
    passed?: number;
    total?: number;
    releaseDecision?: string;
    allSoftwareObjective?: string;
    accepted?: boolean;
    packagingGated?: boolean;
    canRelease?: boolean;
  }>(path.join(extractDir, "artifacts", "productization", "product-takeover-entry-consistency.json"));
  const extractedProjectTakeoverAssessment = readTextFile(path.join(extractDir, "PROJECT_TAKEOVER_ASSESSMENT.md"));
  const extractedProjectTakeoverAssessmentVerification = readJsonFile<{ responseMode?: string; status?: string; passed?: number; total?: number; releaseDecision?: string; allSoftwareObjective?: string; accepted?: boolean; packagingGated?: boolean; canRelease?: boolean; canActivateRealModel?: boolean }>(path.join(extractDir, "artifacts", "productization", "project-takeover-assessment-verification.json"));
  const extractedWorkflowPath = path.join(extractDir, productizationWorkflowRelativePath);
  const extractedWorkflow = readTextFile(extractedWorkflowPath);
  const extractedUploadReadme = readTextFile(path.join(extractDir, "GITHUB_UPLOAD_README.md"));
  const extractedDeliveryIndexBuilder = readTextFile(path.join(extractDir, "scripts", "build-product-delivery-index.ts"));
  const extractedDeliveryIndexVerifier = readTextFile(path.join(extractDir, "scripts", "verify-product-delivery-index.ts"));
  const extractedGithubSourceBuilder = readTextFile(path.join(extractDir, "scripts", "build-github-source-package.ts"));
  const extractedGithubSourceVerifier = readTextFile(path.join(extractDir, "scripts", "verify-github-source-package.ts"));
  const extractedProductizationRunner = readTextFile(path.join(extractDir, "scripts", "run-productization-ci.ts"));
  const extractedHumanAcceptanceReceiptVerifier = readTextFile(path.join(extractDir, 'scripts', 'verify-human-acceptance-receipt.ts'));
  const extractedRealModelTrialReceiptVerifier = readTextFile(path.join(extractDir, 'scripts', 'verify-real-model-trial-receipt.ts'));
  const extractedReleaseApprovalVerifier = readTextFile(path.join(extractDir, 'scripts', 'verify-product-release-approval.ts'));
  const extractedFirstRealTesterSendBundle = readJsonFile<{
    responseMode?: string;
    status?: string;
    selectedLane?: { id?: string };
    releaseDecision?: string;
    accepted?: boolean;
    packagingGated?: boolean;
    canRelease?: boolean;
    canActivateRealModel?: boolean;
    actualSendPerformed?: boolean;
    sendFiles?: Array<{ bundlePath?: string; bytes?: number; sha256?: string }>;
    returnFiles?: Array<{ bundlePath?: string; bytes?: number; sha256?: string }>;
  }>(path.join(extractDir, 'artifacts', 'productization', 'first-real-tester-send-bundle.json'));
  const extractedFirstRealTesterSendBundleVerification = readJsonFile<{
    status?: string;
    passed?: number;
    total?: number;
    checks?: Array<{ name?: string; pass?: boolean; evidence?: string }>;
  }>(path.join(extractDir, 'artifacts', 'productization', 'first-real-tester-send-bundle-verification.json'));
  const extractedFirstRealTesterSendBundleMarkdown = readTextFile(
    path.join(extractDir, 'artifacts', 'productization', 'first-real-tester-send-bundle.md')
  );
  const extractedFirstRealTesterContactReadiness = readJsonFile<{
    status?: string;
    contactAllowed?: boolean;
    contactDecision?: string;
    selectedLane?: { id?: string };
    failedRequiredChecks?: string[];
    releaseDecision?: string;
    accepted?: boolean;
    packagingGated?: boolean;
    canRelease?: boolean;
    canActivateRealModel?: boolean;
  }>(path.join(extractDir, 'artifacts', 'productization', 'first-real-tester-contact-readiness.json'));
  const extractedFirstRealTesterContactReadinessVerification = readJsonFile<{
    status?: string;
    passed?: number;
    total?: number;
    contactReadinessStatus?: string;
    contactAllowed?: boolean;
  }>(path.join(extractDir, 'artifacts', 'productization', 'first-real-tester-contact-readiness-verification.json'));
  const extractedFirstRealTesterContactReadinessMarkdown = readTextFile(
    path.join(extractDir, 'artifacts', 'productization', 'first-real-tester-contact-readiness.md')
  );
  const extractedFirstRealTesterSendExecutionBrief = readJsonFile<{
    status?: string;
    manualSendAllowed?: boolean;
    actualSendPerformed?: boolean;
    releaseDecision?: string;
    accepted?: boolean;
    packagingGated?: boolean;
    canRelease?: boolean;
    canActivateRealModel?: boolean;
  }>(path.join(extractDir, 'artifacts', 'productization', 'first-real-tester-send-execution-brief.json'));
  const extractedFirstRealTesterSendExecutionBriefVerification = readJsonFile<{
    status?: string;
    passed?: number;
    total?: number;
    manualSendAllowed?: boolean;
    actualSendPerformed?: boolean;
  }>(path.join(extractDir, 'artifacts', 'productization', 'first-real-tester-send-execution-brief-verification.json'));
  const extractedFirstRealTesterSendExecutionBriefMarkdown = readTextFile(
    path.join(extractDir, 'artifacts', 'productization', 'first-real-tester-send-execution-brief.md')
  );
  const extractedFirstRealTesterSendReceiptTemplate = readJsonFile<{
    status?: string;
    defaultDecision?: string;
    releaseDecision?: string;
    accepted?: boolean;
    packagingGated?: boolean;
    canRelease?: boolean;
    canActivateRealModel?: boolean;
    receiptFields?: {
      sentMaterials?: Array<{ bundlePath?: string; expectedBytes?: number; expectedSha256?: string }>;
      retainedByMaintainer?: Array<{ bundlePath?: string; expectedBytes?: number; expectedSha256?: string }>;
    };
  }>(path.join(extractDir, 'artifacts', 'productization', 'first-real-tester-send-receipt.template.json'));
  const extractedFirstRealTesterSendReceiptTemplateVerification = readJsonFile<{
    status?: string;
    passed?: number;
    total?: number;
    checks?: Array<{ name?: string; pass?: boolean; evidence?: string }>;
  }>(path.join(extractDir, 'artifacts', 'productization', 'first-real-tester-send-receipt-template-verification.json'));
  const extractedFirstRealTesterSendReceiptTemplateMarkdown = readTextFile(
    path.join(extractDir, 'artifacts', 'productization', 'first-real-tester-send-receipt-template.md')
  );
  const extractedFirstRealTesterFinalGoNoGo = readJsonFile<{
    responseMode?: string;
    status?: string;
    selectedLane?: string;
    releaseDecision?: string;
    allSoftwareObjective?: string;
    reviewOnly?: boolean;
    accepted?: boolean;
    packagingGated?: boolean;
    canRelease?: boolean;
    canActivateRealModel?: boolean;
    manualSendAllowed?: boolean;
    actualSendPerformed?: boolean;
    externalSendFolder?: string;
    validationEvidencePath?: string;
    returnGatePath?: string;
    failedRequiredChecks?: string[];
    checks?: Array<{ name?: string; pass?: boolean; requiredForGo?: boolean; evidence?: string }>;
    operatorFinalAssertions?: string[];
  }>(path.join(extractDir, 'artifacts', 'productization', 'first-real-tester-final-go-no-go.json'));
  const extractedFirstRealTesterFinalGoNoGoVerification = readJsonFile<{
    responseMode?: string;
    status?: string;
    passed?: number;
    total?: number;
    releaseDecision?: string;
    allSoftwareObjective?: string;
    reviewOnly?: boolean;
    accepted?: boolean;
    packagingGated?: boolean;
    canRelease?: boolean;
    canActivateRealModel?: boolean;
    manualSendAllowed?: boolean;
    actualSendPerformed?: boolean;
    checks?: Array<{ name?: string; pass?: boolean; evidence?: string }>;
  }>(path.join(extractDir, 'artifacts', 'productization', 'first-real-tester-final-go-no-go-verification.json'));
  const extractedFirstRealTesterFinalGoNoGoMarkdown = readTextFile(
    path.join(extractDir, 'artifacts', 'productization', 'first-real-tester-final-go-no-go.md')
  );
  const extractedSendBundleVerifierScript = readTextFile(path.join(extractDir, 'scripts', 'verify-first-real-tester-send-bundle.ts'));
  const extractedSendReceiptVerifierScript = readTextFile(path.join(extractDir, 'scripts', 'verify-first-real-tester-send-receipt-template.ts'));
  const extractedFinalGoNoGoBuilderScript = readTextFile(path.join(extractDir, 'scripts', 'build-first-real-tester-final-go-no-go.ts'));
  const extractedFinalGoNoGoVerifierScript = readTextFile(path.join(extractDir, 'scripts', 'verify-first-real-tester-final-go-no-go.ts'));
  const extractedFirstRealTesterReturnWorkbench = readJsonFile<{
    status?: string;
    releaseDecision?: string;
    accepted?: boolean;
    packagingGated?: boolean;
    canRelease?: boolean;
    canActivateRealModel?: boolean;
    sendReceiptHandoff?: {
      requiredBeforeReturnIntake?: boolean;
      sendBundleFingerprintGate?: string;
      submittedSendReceiptValidation?: string;
      validationCommand?: string;
      validationEvidencePath?: string;
    };
  }>(path.join(extractDir, 'artifacts', 'productization', 'first-real-tester-return-workbench.json'));
  const extractedFirstRealTesterReturnWorkbenchVerification = readJsonFile<{
    status?: string;
    passed?: number;
    total?: number;
    checks?: Array<{ name?: string; pass?: boolean; evidence?: string }>;
  }>(path.join(extractDir, 'artifacts', 'productization', 'first-real-tester-return-workbench-verification.json'));
  const extractedFirstRealTesterReturnWorkbenchMarkdown = readTextFile(
    path.join(extractDir, 'artifacts', 'productization', 'first-real-tester-return-workbench.md')
  );
  const extractedReturnWorkbenchVerifierScript = readTextFile(path.join(extractDir, 'scripts', 'verify-first-real-tester-return-workbench.ts'));
  const extractedPublicBetaReturnIntakeScript = readTextFile(path.join(extractDir, 'scripts', 'intake-public-beta-return.ts'));
  const extractedHumanAcceptanceReturnIntakeScript = readTextFile(path.join(extractDir, 'scripts', 'intake-human-acceptance-return.ts'));
  const extractedPublicBetaReturnIntakeVerifierScript = readTextFile(path.join(extractDir, 'scripts', 'verify-public-beta-return-intake.ts'));
  const extractedHumanAcceptanceReturnIntakeVerifierScript = readTextFile(path.join(extractDir, 'scripts', 'verify-human-acceptance-return-intake.ts'));
  const extractedBundleFilePath = (bundlePath?: string) =>
    path.join(extractDir, 'artifacts', 'productization', 'first-real-tester-send-bundle', bundlePath ?? 'missing');
  const extractedBundleFingerprintMatches = (file: { bundlePath?: string; bytes?: number; sha256?: string }) => {
    const fullPath = extractedBundleFilePath(file.bundlePath);
    return (
      fileExistsWithSize(fullPath, 1) &&
      fs.statSync(fullPath).size === file.bytes &&
      /^[a-f0-9]{64}$/.test(file.sha256 ?? '') &&
      sha256File(fullPath) === file.sha256
    );
  };
  const extractedReceiptFingerprintMatches = (file: { bundlePath?: string; expectedBytes?: number; expectedSha256?: string }) => {
    const fullPath = extractedBundleFilePath(file.bundlePath);
    return (
      fileExistsWithSize(fullPath, 1) &&
      fs.statSync(fullPath).size === file.expectedBytes &&
      /^[a-f0-9]{64}$/.test(file.expectedSha256 ?? '') &&
      sha256File(fullPath) === file.expectedSha256
    );
  };
  const extractedReleaseApprovalTemplate = readJsonFile<{
    prerequisiteEvidence?: {
      aiServiceStatusPath?: string;
    };
  }>(path.join(extractDir, 'artifacts', 'productization', 'product-release-approval.template.json'));
  const extractedPacketReleaseApprovalTemplate = readJsonFile<{
    prerequisiteEvidence?: {
      aiServiceStatusPath?: string;
    };
  }>(
    path.join(
      extractDir,
      'artifacts',
      'productization',
      'public-beta-packet',
      'docs',
      'PRODUCT_RELEASE_APPROVAL.template.json'
    )
  );
  const extractedUploadReadmeFirstFilesSection = extractedUploadReadme.split("## First Files To Read")[1]?.split("\n## ")[0] ?? "";
  const extractedTakeoverMatrixMarkdown = readTextFile(
    path.join(extractDir, "artifacts", "productization", "product-takeover-decision-matrix.md")
  );
  const extractedLaunchChecklistMarkdown = readTextFile(
    path.join(extractDir, "artifacts", "productization", "productization-launch-checklist.md")
  );
  const extractedReadme = readTextFile(path.join(extractDir, "README.md"));
  const extractedPublicBetaManifest = readJsonFile<{
    responseMode?: string;
    status?: string;
    betaCanStart?: boolean;
    requiredPassed?: number;
    requiredTotal?: number;
    releaseDecision?: string;
    allSoftwareObjective?: string;
  }>(path.join(extractDir, "artifacts", "productization", "public-beta-packet", "public-beta-manifest.json"));
  const extractedStartPublicBeta = readTextFile(
    path.join(extractDir, "artifacts", "productization", "public-beta-packet", "START_PUBLIC_BETA.md")
  );
  const extractedPublicBetaSessionPlan = readTextFile(
    path.join(extractDir, "artifacts", "productization", "public-beta-packet", "docs", "PUBLIC_BETA_SESSION_PLAN.md")
  );
  const extractedPublicBetaTesterInvite = readTextFile(
    path.join(extractDir, "artifacts", "productization", "public-beta-packet", "docs", "PUBLIC_BETA_TESTER_INVITE.md")
  );
  const extractedPublicBetaReadiness = readJsonFile<{
    responseMode?: string;
    status?: string;
    passed?: number;
    total?: number;
    checks?: Array<{ name?: string; pass?: boolean; evidence?: string }>;
  }>(path.join(extractDir, "artifacts", "productization", "public-beta-readiness.json"));
  const extractedHumanAcceptanceReceiptTemplate = readJsonFile<{
    gateVerification?: {
      gateReportPath?: string;
      command?: string;
      status?: string;
      latestEvidenceKind?: string;
      latestHumanReviewed?: boolean | null;
      latestAutomationGenerated?: boolean | null;
    };
  }>(path.join(extractDir, 'artifacts', 'productization', 'human-acceptance-receipt.template.json'));
  const extractedPacketHumanAcceptanceReceiptTemplate = readJsonFile<{
    gateVerification?: {
      gateReportPath?: string;
      command?: string;
      status?: string;
      latestEvidenceKind?: string;
      latestHumanReviewed?: boolean | null;
      latestAutomationGenerated?: boolean | null;
    };
  }>(
    path.join(
      extractDir,
      'artifacts',
      'productization',
      'public-beta-packet',
      'docs',
      'HUMAN_ACCEPTANCE_RECEIPT.template.json'
    )
  );

  const extractedRealModelTrialReceiptTemplate = readJsonFile<{
    postTrialStatus?: {
      aiServiceStatusAfterRollbackPath?: string;
      activeProviderAfterRollback?: string;
      manualProviderAcceptanceAfterRollback?: boolean | null;
    };
    trialChecks?: {
      rollbackToMockConfirmed?: boolean | null;
    };
  }>(path.join(extractDir, 'artifacts', 'productization', 'real-model-trial-receipt.template.json'));

  const rootLocalCiVerification = readJsonFile<{
    responseMode?: string;
    status?: string;
    generatedAt?: string;
    passed?: number;
    total?: number;
    releaseDecision?: string;
    accepted?: boolean;
    packagingGated?: boolean;
  }>(path.join(rootDir, "artifacts", "productization", "productization-ci-local-verification.json"));
  const extractedLocalCiReceipt = readJsonFile<{
    responseMode?: string;
    status?: string;
    releaseDecision?: string;
    accepted?: boolean;
    packagingGated?: boolean;
  }>(path.join(extractDir, "artifacts", "productization", "productization-ci-local.json"));
  const extractedLocalCiVerification = readJsonFile<{
    responseMode?: string;
    status?: string;
    passed?: number;
    total?: number;
    releaseDecision?: string;
    accepted?: boolean;
    packagingGated?: boolean;
  }>(path.join(extractDir, "artifacts", "productization", "productization-ci-local-verification.json"));
  const extractedPublicBetaInstructionCheck = extractedPublicBetaReadiness?.checks?.find(
    (check) => check.name === "Public beta instructions and feedback template exist"
  );
  const extractedProductTrialVerificationCheck = extractedPublicBetaReadiness?.checks?.find(
    (check) => check.name === "Product trial packet verification is packaged and current"
  );

  push(
    checks,
    "Archive extracts successfully",
    extract.ok && extractedFiles.length > 100,
    `ok=${extract.ok}; files=${extractedFiles.length}; output=${extract.output.slice(0, 160) || "none"}`
  );

  push(
    checks,
    "Extracted archive includes app source and upload instructions",
    fileExistsWithSize(path.join(extractDir, "package.json"), 1000) &&
      fileExistsWithSize(path.join(extractDir, "package-lock.json"), 1000) &&
      fileExistsWithSize(path.join(extractDir, "README.md"), 1000) &&
      fileExistsWithSize(path.join(extractDir, "GITHUB_UPLOAD_README.md"), 1000) &&
      fs.existsSync(path.join(extractDir, "src")) &&
      fs.existsSync(path.join(extractDir, "scripts")) &&
      fs.existsSync(path.join(extractDir, "prisma")) &&
      fs.existsSync(path.join(extractDir, "plugins")),
    `packageJson=${fileExistsWithSize(path.join(extractDir, "package.json"), 1000)}; src=${fs.existsSync(path.join(extractDir, "src"))}; scripts=${fs.existsSync(path.join(extractDir, "scripts"))}`
  );

  push(
    checks,
    "Extracted README marks delivery index as post-package outer handoff evidence",
    extractedReadme.includes("post-package outer delivery index") &&
      extractedReadme.includes("after `npm run verify:github-source` passes") &&
      extractedReadme.includes("post-package outer handoff index generated after `npm run verify:github-source`") &&
      extractedReadme.includes("rebuild it after every refreshed source zip"),
    `postPackage=${extractedReadme.includes("post-package outer delivery index")}; afterVerify=${extractedReadme.includes(
      "after `npm run verify:github-source` passes"
    )}; rebuild=${extractedReadme.includes("rebuild it after every refreshed source zip")}`
  );

  const rootReadmeHasCrossPlatformEnvSetup =
    extractedReadme.includes("node -e ") &&
    extractedReadme.includes("PowerShell alternative: `Copy-Item .env.example .env`") &&
    extractedReadme.includes("bash alternative: `cp .env.example .env`") &&
    !extractedReadme.includes("copy .env.example .env\nnpm run setup:demo");

  push(
    checks,
    "Extracted README uses cross-platform local env bootstrap",
    rootReadmeHasCrossPlatformEnvSetup,
    "nodeBootstrap=" + extractedReadme.includes("node -e ") +
      "; powershellAlternative=" +
      extractedReadme.includes("PowerShell alternative: `Copy-Item .env.example .env`") +
      "; bashAlternative=" +
      extractedReadme.includes("bash alternative: `cp .env.example .env`") +
      "; oldCopyCommand=" +
      extractedReadme.includes("copy .env.example .env\nnpm run setup:demo")
  );

  push(
    checks,
    "Extracted upload README points to productization entrypoints",
    extractedUploadReadme.includes("## First Files To Read") &&
      extractedUploadReadme.includes("artifacts/productization/product-takeover-decision-matrix.md") &&
      extractedUploadReadme.includes("artifacts/productization/productization-launch-checklist.md") &&
      extractedUploadReadme.includes("artifacts/productization/first-real-tester-launch.md") &&
      extractedUploadReadme.includes("artifacts/productization/first-real-tester-dispatch-packet/START_FIRST_REAL_TESTER.md") &&
      extractedUploadReadme.includes("artifacts/productization/first-real-tester-send-bundle.md") &&
      extractedUploadReadme.includes("artifacts/productization/first-real-tester-send-bundle/SEND_TO_FIRST_EXTERNAL_PERSON") &&
      extractedUploadReadme.includes("first-real-tester-contact-readiness.md") &&
      extractedUploadReadme.includes("contactAllowed=true") &&
      extractedUploadReadme.includes("artifacts/productization/first-real-tester-contact-readiness.md") &&
      extractedUploadReadme.includes("artifacts/productization/first-real-tester-send-execution-brief.md") &&
      extractedUploadReadme.includes("manualSendAllowed=true") &&
      extractedUploadReadme.includes("actualSendPerformed=false") &&
      extractedUploadReadme.includes("artifacts/productization/first-real-tester-send-receipt-template.md") &&
      extractedUploadReadme.includes("artifacts/productization/first-real-tester-return-workbench.md") &&
      extractedUploadReadme.includes("artifacts/productization/first-real-tester-return-gate.md") &&
      extractedUploadReadme.includes("artifacts/productization/product-status-summary.md") &&
      phraseOrder(
        extractedUploadReadmeFirstFilesSection,
        "artifacts/productization/product-takeover-decision-matrix.md",
        "artifacts/productization/productization-launch-checklist.md"
      ) &&
      phraseOrder(
        extractedUploadReadmeFirstFilesSection,
        "artifacts/productization/productization-launch-checklist.md",
        "artifacts/productization/first-real-tester-launch.md"
      ) &&
      phraseOrder(
        extractedUploadReadmeFirstFilesSection,
        "artifacts/productization/first-real-tester-launch.md",
        "artifacts/productization/first-real-tester-dispatch-packet/START_FIRST_REAL_TESTER.md"
      ) &&
      phraseOrder(
        extractedUploadReadmeFirstFilesSection,
        "artifacts/productization/first-real-tester-dispatch-packet/START_FIRST_REAL_TESTER.md",
        "artifacts/productization/first-real-tester-send-bundle.md"
      ) &&
      phraseOrder(
        extractedUploadReadmeFirstFilesSection,
        "artifacts/productization/first-real-tester-send-bundle.md",
        "artifacts/productization/first-real-tester-contact-readiness.md"
      ) &&
      phraseOrder(
        extractedUploadReadmeFirstFilesSection,
        "artifacts/productization/first-real-tester-contact-readiness.md",
        "artifacts/productization/first-real-tester-send-receipt-template.md"
      ) &&
      phraseOrder(
        extractedUploadReadmeFirstFilesSection,
        "artifacts/productization/first-real-tester-contact-readiness.md",
        "artifacts/productization/first-real-tester-send-execution-brief.md"
      ) &&
      phraseOrder(
        extractedUploadReadmeFirstFilesSection,
        "artifacts/productization/first-real-tester-send-execution-brief.md",
        "artifacts/productization/first-real-tester-send-receipt-template.md"
      ) &&
      phraseOrder(
        extractedUploadReadmeFirstFilesSection,
        "artifacts/productization/first-real-tester-send-receipt-template.md",
        "artifacts/productization/first-real-tester-return-workbench.md"
      ) &&
      phraseOrder(
        extractedUploadReadmeFirstFilesSection,
        "artifacts/productization/first-real-tester-return-gate.md",
        "artifacts/productization/product-status-summary.md"
      ) &&
      extractedUploadReadme.includes("artifacts/productization/product-operator-brief.md") &&
      extractedUploadReadme.includes("artifacts/productization/public-beta-packet/START_PUBLIC_BETA.md") &&
      extractedUploadReadme.includes("artifacts/productization/public-beta-packet/docs/PUBLIC_BETA_SESSION_PLAN.md") &&
      extractedUploadReadme.includes("artifacts/productization/public-beta-packet/docs/PUBLIC_BETA_SESSION_RECEIPT.template.json") &&
      extractedUploadReadme.includes("npm run verify:public-beta-session-receipt -- --receipt <path>") &&
      extractedUploadReadme.includes("same tester.name/tester.date") &&
      extractedUploadReadme.includes("sessionEvidence.feedbackReceiptPath") &&
      extractedUploadReadme.includes("artifacts/productization/public-beta-packet/docs/PUBLIC_BETA_TESTER_RUNBOOK.md") &&
      extractedUploadReadme.includes("releaseDecision") &&
      extractedUploadReadme.includes("do_not_release") &&
      extractedUploadReadme.includes("accepted=false") &&
      extractedUploadReadme.includes("packagingGated=true") &&
      extractedUploadReadme.includes("allSoftwareObjective=paused") &&
      extractedUploadReadme.includes("package.json#scripts") &&
      extractedUploadReadme.includes("command contract"),
    `firstFiles=${extractedUploadReadme.includes("## First Files To Read")}; takeover=${extractedUploadReadme.includes("artifacts/productization/product-takeover-decision-matrix.md")}; launch=${extractedUploadReadme.includes(
      "artifacts/productization/productization-launch-checklist.md"
    )}; takeoverBeforeLaunch=${phraseOrder(
      extractedUploadReadmeFirstFilesSection,
      "artifacts/productization/product-takeover-decision-matrix.md",
      "artifacts/productization/productization-launch-checklist.md"
    )}; launchBeforeFirstReal=${phraseOrder(
      extractedUploadReadmeFirstFilesSection,
      "artifacts/productization/productization-launch-checklist.md",
      "artifacts/productization/first-real-tester-launch.md"
    )}; dispatchBeforeSendBundle=${phraseOrder(
      extractedUploadReadmeFirstFilesSection,
      "artifacts/productization/first-real-tester-dispatch-packet/START_FIRST_REAL_TESTER.md",
      "artifacts/productization/first-real-tester-send-bundle.md"
    )}; sendBundleBeforeReturnGate=${phraseOrder(
      extractedUploadReadmeFirstFilesSection,
      "artifacts/productization/first-real-tester-send-bundle.md",
      "artifacts/productization/first-real-tester-return-gate.md"
    )}; returnGateBeforeStatus=${phraseOrder(
      extractedUploadReadmeFirstFilesSection,
      "artifacts/productization/first-real-tester-return-gate.md",
      "artifacts/productization/product-status-summary.md"
    )}; statusSummary=${extractedUploadReadme.includes(
      "artifacts/productization/product-status-summary.md"
    )}; operatorBrief=${extractedUploadReadme.includes(
      "artifacts/productization/product-operator-brief.md"
    )}; release=${extractedUploadReadme.includes("do_not_release")}; commandContract=${extractedUploadReadme.includes("command contract")}`
  );

  push(
    checks,
    "Extracted upload README exposes human acceptance return post-intake refresh gate",
    extractedUploadReadme.includes("npm run intake:human-acceptance-return -- --receipt <path> --send-receipt-validation artifacts/productization/first-real-tester-send-receipt-validation.json") &&
      extractedUploadReadme.includes("npm run verify:human-acceptance-return-intake") &&
      extractedUploadReadme.includes("postIntakeRefresh.commandSequence") &&
      extractedUploadReadme.includes("refreshed reviewer invite") &&
      extractedUploadReadme.includes("evidence freshness files"),
    `intake=${extractedUploadReadme.includes(
      "npm run intake:human-acceptance-return -- --receipt <path> --send-receipt-validation artifacts/productization/first-real-tester-send-receipt-validation.json"
    )}; verifier=${extractedUploadReadme.includes(
      "npm run verify:human-acceptance-return-intake"
    )}; postRefresh=${extractedUploadReadme.includes("postIntakeRefresh.commandSequence")}`
  );
  push(
    checks,
    "Extracted upload README routes returned release and model receipts through intake before verification",
    phraseOrder(
      extractedUploadReadme,
      "npm run intake:product-release-approval-return -- --receipt <path>",
      "npm run verify:product-release-approval-return-intake"
    ) &&
      phraseOrder(
        extractedUploadReadme,
        "npm run intake:real-model-trial-return -- --receipt <path>",
        "npm run verify:real-model-trial-return-intake"
      ) &&
      extractedUploadReadme.includes("before relying on separate release-review evidence") &&
      extractedUploadReadme.includes("before relying on real-provider trial evidence"),
    `releaseOrder=${phraseOrder(
      extractedUploadReadme,
      "npm run intake:product-release-approval-return -- --receipt <path>",
      "npm run verify:product-release-approval-return-intake"
    )}; modelOrder=${phraseOrder(
      extractedUploadReadme,
      "npm run intake:real-model-trial-return -- --receipt <path>",
      "npm run verify:real-model-trial-return-intake"
    )}`
  );

  push(
    checks,
    "Extracted upload README exposes real-model credential redaction handoff",
    extractedUploadReadme.includes("artifacts/productization/real-model-trial-kit.md#credential-redaction-checklist") &&
      extractedUploadReadme.includes("redacted_environment_summary") &&
      extractedUploadReadme.includes("artifact_secret_scan_before_return") &&
      extractedUploadReadme.includes("trial_log_minimization") &&
      extractedUploadReadme.includes("rollback_to_mock_after_trial") &&
      extractedUploadReadme.includes("stop if any returned artifact contains a secret") &&
      manifest?.uploadChecklist?.some(
        (item) =>
          item.includes("artifacts/productization/real-model-trial-kit.md#credential-redaction-checklist") &&
          item.includes("rollback_to_mock_after_trial") &&
          item.includes("stop if any returned artifact contains a secret")
      ) === true,
    `readme=${extractedUploadReadme.includes("artifacts/productization/real-model-trial-kit.md#credential-redaction-checklist")}; rollback=${extractedUploadReadme.includes(
      "rollback_to_mock_after_trial"
    )}; checklist=${manifest?.uploadChecklist?.some((item) => item.includes("artifacts/productization/real-model-trial-kit.md#credential-redaction-checklist")) ?? false}`
  );

  push(
    checks,
    'Extracted real-model trial receipt requires post-trial mock rollback evidence',
    extractedRealModelTrialReceiptTemplate?.postTrialStatus?.aiServiceStatusAfterRollbackPath === '' &&
      extractedRealModelTrialReceiptTemplate.postTrialStatus.manualProviderAcceptanceAfterRollback === null &&
      extractedRealModelTrialReceiptTemplate.trialChecks?.rollbackToMockConfirmed === null &&
      extractedRealModelTrialReceiptVerifier.includes('Submitted post-trial status proves rollback to mock fallback') &&
      extractedRealModelTrialReceiptVerifier.includes('rollbackToMockConfirmed === true') &&
      extractedRealModelTrialReceiptVerifier.includes('activeProviderAfterRollback'),
    'postPathNeutral=' +
      (extractedRealModelTrialReceiptTemplate?.postTrialStatus?.aiServiceStatusAfterRollbackPath === '') +
      '; rollbackNeutral=' +
      (extractedRealModelTrialReceiptTemplate?.trialChecks?.rollbackToMockConfirmed === null) +
      '; verifierRollbackCheck=' +
      extractedRealModelTrialReceiptVerifier.includes('Submitted post-trial status proves rollback to mock fallback')
  );

  push(
    checks,
    'Extracted product release approval requires post-trial runtime rollback evidence',
    extractedReleaseApprovalTemplate?.prerequisiteEvidence?.aiServiceStatusPath === '' &&
      extractedPacketReleaseApprovalTemplate?.prerequisiteEvidence?.aiServiceStatusPath === '' &&
      extractedReleaseApprovalVerifier.includes('isPostTrialMockRollbackEvidence') &&
      extractedReleaseApprovalVerifier.includes('ai_service_runtime_status_json_v1') &&
      extractedReleaseApprovalVerifier.includes('manualProviderAcceptance'),
    'rootPathNeutral=' +
      (extractedReleaseApprovalTemplate?.prerequisiteEvidence?.aiServiceStatusPath === '') +
      '; packetPathNeutral=' +
      (extractedPacketReleaseApprovalTemplate?.prerequisiteEvidence?.aiServiceStatusPath === '') +
      '; verifierRollbackCheck=' +
      extractedReleaseApprovalVerifier.includes('isPostTrialMockRollbackEvidence')
  );

  push(
    checks,
    "Extracted archive has no forbidden payload",
    extractedViolations.length === 0,
    `violations=${extractedViolations.slice(0, 10).join(",") || "none"}`
  );
  push(
    checks,
    "Extracted archive includes productization CI workflow",
    fileExistsWithSize(extractedWorkflowPath, 500) && workflowHasProductizationGates(extractedWorkflow),
    `workflow=${fileExistsWithSize(extractedWorkflowPath, 500)}; gates=${workflowHasProductizationGates(
      extractedWorkflow
    )}`
  );

  push(
    checks,
    `Extracted package declares runtime prerequisites`,
    extractedPackageJson?.packageManager === `npm@11.12.1` &&
      extractedPackageJson.engines?.node === `>=22 <25` &&
      extractedPackageJson.engines?.npm === `>=10` &&
      extractedWorkflow.includes(`node-version: "22"`) &&
      extractedUploadReadme.includes(`npm install`) &&
      extractedUploadReadme.includes(`>=22 <25`) &&
      extractedUploadReadme.includes(`>=10`) &&
      extractedUploadReadme.includes(`package.json#engines`) &&
      extractedUploadReadme.includes(`Productization CI Node 22`) &&
      extractedUploadReadme.includes(`npm run verify:product -- --port 3110`) &&
      extractedUploadReadme.includes(`product_health_json_v1`),
    `packageManager=${extractedPackageJson?.packageManager ?? `missing`}; node=${extractedPackageJson?.engines?.node ?? `missing`}; npm=${extractedPackageJson?.engines?.npm ?? `missing`}; workflowNode22=${extractedWorkflow.includes(`node-version: "22"`)}`
  );
  push(
    checks,
    "Extracted package exposes GitHub source verification commands",
    extractedPackageJson?.scripts?.["package:github-source"] === "tsx scripts/build-github-source-package.ts" &&
      extractedPackageJson.scripts?.["verify:github-source"] === "tsx scripts/verify-github-source-package.ts" &&
      extractedPackageJson.scripts?.["verify:new-repo-bootstrap"] === "node scripts/verify-new-repository-bootstrap.mjs" &&
      extractedPackageJson.scripts?.["build:product-delivery-index"] === "tsx scripts/build-product-delivery-index.ts" &&
      extractedPackageJson.scripts?.["verify:product-delivery-index"] === "tsx scripts/verify-product-delivery-index.ts" &&
      extractedPackageJson.scripts?.["build:first-real-tester-contact-readiness"] === "tsx scripts/build-first-real-tester-contact-readiness.ts" &&
      extractedPackageJson.scripts?.["verify:first-real-tester-contact-readiness"] === "tsx scripts/verify-first-real-tester-contact-readiness.ts" &&
      extractedPackageJson.scripts?.["build:first-real-tester-send-execution-brief"] === "tsx scripts/build-first-real-tester-send-execution-brief.ts" &&
      extractedPackageJson.scripts?.["verify:first-real-tester-send-execution-brief"] === "tsx scripts/verify-first-real-tester-send-execution-brief.ts" &&
      extractedPackageJson.scripts?.["build:productization-launch-checklist"] === "tsx scripts/build-productization-launch-checklist.ts" &&
      extractedPackageJson.scripts?.["verify:productization-launch-checklist"] === "tsx scripts/verify-productization-launch-checklist.ts" &&
      extractedPackageJson.scripts?.["build:human-acceptance-reviewer-invite"] === "tsx scripts/build-human-acceptance-reviewer-invite.ts" &&
      extractedPackageJson.scripts?.["verify:human-acceptance-reviewer-invite"] === "tsx scripts/verify-human-acceptance-reviewer-invite.ts" &&
      extractedPackageJson.scripts?.["verify:product-trial"] === "tsx scripts/verify-product-trial-packet.ts" &&
      extractedPackageJson.scripts?.["verify:project-takeover-assessment"] === "tsx scripts/verify-project-takeover-assessment.ts" &&
      extractedPackageJson.scripts?.["ci:productization"] === "tsx scripts/run-productization-ci.ts" &&
      extractedPackageJson.scripts?.["verify:productization-ci-local"] === "tsx scripts/verify-productization-ci-local.ts" &&
      scriptHasProductizationGates(extractedPackageJson.scripts?.["ci:productization:gates"]),
    `package=${extractedPackageJson?.scripts?.["package:github-source"] ?? "missing"}; verify=${
      extractedPackageJson?.scripts?.["verify:github-source"] ?? "missing"
    }; bootstrap=${extractedPackageJson?.scripts?.["verify:new-repo-bootstrap"] ?? "missing"}; delivery=${extractedPackageJson?.scripts?.["build:product-delivery-index"] ?? "missing"}/${extractedPackageJson?.scripts?.["verify:product-delivery-index"] ?? "missing"}; launch=${extractedPackageJson?.scripts?.["build:productization-launch-checklist"] ?? "missing"}/${extractedPackageJson?.scripts?.["verify:productization-launch-checklist"] ?? "missing"}; humanInvite=${extractedPackageJson?.scripts?.["build:human-acceptance-reviewer-invite"] ?? "missing"}/${extractedPackageJson?.scripts?.["verify:human-acceptance-reviewer-invite"] ?? "missing"}; productTrial=${extractedPackageJson?.scripts?.["verify:product-trial"] ?? "missing"}; assessment=${extractedPackageJson?.scripts?.["verify:project-takeover-assessment"] ?? "missing"}`
  );


  push(
    checks,
    "Extracted package passes dependency-free new-repository bootstrap check",
    extractedBootstrap.status === 0 &&
      extractedBootstrapReceipt?.responseMode === "new_repository_bootstrap_verification_json_v1" &&
      extractedBootstrapReceipt.status === "passed" &&
      extractedBootstrapReceipt.passed === extractedBootstrapReceipt.total &&
      Number(extractedBootstrapReceipt.total ?? 0) >= 9 &&
      extractedBootstrapReceipt.releaseDecision === "do_not_release" &&
      extractedBootstrapReceipt.allSoftwareObjective === "paused" &&
      extractedBootstrapReceipt.accepted === false &&
      extractedBootstrapReceipt.packagingGated === true &&
      extractedBootstrapReceipt.canRelease === false &&
      extractedBootstrapReceipt.canActivateRealModel === false,
    `exit=${extractedBootstrap.status ?? "missing"}; status=${extractedBootstrapReceipt?.status ?? "missing"}; checks=${extractedBootstrapReceipt?.passed ?? "?"}/${extractedBootstrapReceipt?.total ?? "?"}; stderr=${(extractedBootstrap.stderr ?? "").trim().slice(0, 120) || "none"}`
  );

  push(
    checks,
    "Extracted archive carries packaged new-repository bootstrap verification receipt",
    manifest?.newRepositoryBootstrap?.status === "passed" &&
      manifest.newRepositoryBootstrap.passed === manifest.newRepositoryBootstrap.total &&
      Number(manifest.newRepositoryBootstrap.total ?? 0) >= 9 &&
      manifest.newRepositoryBootstrap.releaseDecision === "do_not_release" &&
      manifest.newRepositoryBootstrap.allSoftwareObjective === "paused" &&
      manifest.newRepositoryBootstrap.accepted === false &&
      manifest.newRepositoryBootstrap.packagingGated === true &&
      manifest.newRepositoryBootstrap.canRelease === false &&
      manifest.newRepositoryBootstrap.canActivateRealModel === false &&
      manifest.newRepositoryBootstrap.evidencePath === "artifacts/productization/new-repository-bootstrap-verification.json" &&
      copiedDestinations.has("artifacts/productization/new-repository-bootstrap-verification.json") &&
      extractedPackagedBootstrapReceipt?.responseMode === "new_repository_bootstrap_verification_json_v1" &&
      extractedPackagedBootstrapReceipt.status === "passed" &&
      extractedPackagedBootstrapReceipt.passed === extractedPackagedBootstrapReceipt.total &&
      Number(extractedPackagedBootstrapReceipt.total ?? 0) >= 9 &&
      extractedPackagedBootstrapReceipt.releaseDecision === "do_not_release" &&
      extractedPackagedBootstrapReceipt.allSoftwareObjective === "paused" &&
      extractedPackagedBootstrapReceipt.accepted === false &&
      extractedPackagedBootstrapReceipt.packagingGated === true &&
      extractedPackagedBootstrapReceipt.canRelease === false &&
      extractedPackagedBootstrapReceipt.canActivateRealModel === false,
    `manifest=${manifest?.newRepositoryBootstrap?.status ?? "missing"} ${manifest?.newRepositoryBootstrap?.passed ?? "?"}/${manifest?.newRepositoryBootstrap?.total ?? "?"}; declared=${copiedDestinations.has("artifacts/productization/new-repository-bootstrap-verification.json")}; extracted=${extractedPackagedBootstrapReceipt?.status ?? "missing"} ${extractedPackagedBootstrapReceipt?.passed ?? "?"}/${extractedPackagedBootstrapReceipt?.total ?? "?"}`
  );

  push(
    checks,
    `Extracted delivery index tools enforce command contract`,
    extractedDeliveryIndexBuilder.includes(`commandContract: deliveryCommandContract`) &&
      extractedDeliveryIndexBuilder.includes(`const deliveryCommandScriptNames`) &&
      extractedDeliveryIndexBuilder.includes(`package:github-source`) &&
      extractedDeliveryIndexBuilder.includes(`intake:public-beta-return`) &&
      extractedDeliveryIndexBuilder.includes(`verify:product-release-approval-return-intake`) &&
      extractedDeliveryIndexBuilder.includes(`## Command Contract`) &&
      extractedDeliveryIndexVerifier.includes(`commandContract?:`) &&
      extractedDeliveryIndexVerifier.includes(`const requiredDeliveryScripts`) &&
      extractedDeliveryIndexVerifier.includes(`missingRequiredScripts`) &&
      extractedDeliveryIndexVerifier.includes(`missingActionScripts`) &&
      extractedDeliveryIndexVerifier.includes(`Delivery index command contract matches package scripts`) &&
      extractedDeliveryIndexVerifier.includes(`package.json#scripts`),
    `builder=${extractedDeliveryIndexBuilder.includes(`commandContract: deliveryCommandContract`)}; verifier=${extractedDeliveryIndexVerifier.includes(`Delivery index command contract matches package scripts`)}; missingRequired=${extractedDeliveryIndexVerifier.includes(`missingRequiredScripts`)}; missingAction=${extractedDeliveryIndexVerifier.includes(`missingActionScripts`)}`
  );

  push(
    checks,
    "Extracted return intake tools enforce first-real tester send receipt validation before processing returns",
    extractedPublicBetaReturnIntakeScript.includes("validateFirstRealTesterManualSendReceipt") &&
      extractedPublicBetaReturnIntakeScript.includes("--send-receipt-validation") &&
      extractedPublicBetaReturnIntakeScript.includes("firstRealTesterSendReceiptValidation") &&
      extractedPublicBetaReturnIntakeScript.includes("!firstRealSendReceipt.passed") &&
      extractedHumanAcceptanceReturnIntakeScript.includes("validateFirstRealTesterManualSendReceipt") &&
      extractedHumanAcceptanceReturnIntakeScript.includes("--send-receipt-validation") &&
      extractedHumanAcceptanceReturnIntakeScript.includes("firstRealTesterSendReceiptValidation") &&
      extractedHumanAcceptanceReturnIntakeScript.includes("!firstRealSendReceipt.passed") &&
      extractedHumanAcceptanceReturnIntakeScript.includes("validation.status !== \"passed\"") &&
      extractedPublicBetaReturnIntakeVerifierScript.includes("Missing first-real tester send receipt validation rejects otherwise valid beta return") &&
      extractedHumanAcceptanceReturnIntakeVerifierScript.includes("Missing first-real tester send receipt validation rejects otherwise valid human return") &&
      extractedDeliveryIndexBuilder.includes("--send-receipt-validation artifacts/productization/first-real-tester-send-receipt-validation.json") &&
      extractedDeliveryIndexVerifier.includes("expectedHumanAcceptanceReturnIntake") &&
      extractedDeliveryIndexVerifier.includes("first-real-tester-send-receipt-validation.json"),
    `betaIntake=${extractedPublicBetaReturnIntakeScript.includes("--send-receipt-validation")}; humanIntake=${extractedHumanAcceptanceReturnIntakeScript.includes("--send-receipt-validation")}; betaNegative=${extractedPublicBetaReturnIntakeVerifierScript.includes("Missing first-real tester send receipt validation rejects otherwise valid beta return")}; humanNegative=${extractedHumanAcceptanceReturnIntakeVerifierScript.includes("Missing first-real tester send receipt validation rejects otherwise valid human return")}; deliveryBuilder=${extractedDeliveryIndexBuilder.includes("--send-receipt-validation artifacts/productization/first-real-tester-send-receipt-validation.json")}; deliveryVerifier=${extractedDeliveryIndexVerifier.includes("expectedHumanAcceptanceReturnIntake") && extractedDeliveryIndexVerifier.includes("first-real-tester-send-receipt-validation.json")}`
  );

  push(
    checks,
    `Extracted source package tools preserve archive sha256 integrity`,
    extractedGithubSourceBuilder.includes(`archiveSha256: sha256File(archivePath)`) &&
      extractedGithubSourceBuilder.includes(`createHash`) &&
      extractedGithubSourceBuilder.includes(`sha256`) &&
      extractedGithubSourceBuilder.includes(`digest`) &&
      extractedGithubSourceBuilder.includes(`hex`) &&
      extractedGithubSourceVerifier.includes(`archiveSha256?: string`) &&
      extractedGithubSourceVerifier.includes(`Archive exists and matches manifest size and sha256`) &&
      extractedGithubSourceVerifier.includes(`archiveSha256 === manifest?.archiveSha256`) &&
      extractedGithubSourceVerifier.includes(`archiveSha256: manifest?.archiveSha256 ??`) &&
      extractedGithubSourceVerifier.includes(`/^[a-f0-9]{64}$/`),
    `builderManifest=${extractedGithubSourceBuilder.includes(`archiveSha256: sha256File(archivePath)`)}; builderHash=${extractedGithubSourceBuilder.includes(`createHash`) && extractedGithubSourceBuilder.includes(`sha256`)}; verifierCompare=${extractedGithubSourceVerifier.includes(`archiveSha256 === manifest?.archiveSha256`)}; verifierReceipt=${extractedGithubSourceVerifier.includes(`archiveSha256: manifest?.archiveSha256 ??`)}`
  );

  const deliveryIndexRuntimeRollbackBuilderReady =
    extractedDeliveryIndexBuilder.includes("process_returned_release_approval_receipt") &&
    extractedDeliveryIndexBuilder.includes("runtimeRollbackEvidencePath") &&
    extractedDeliveryIndexBuilder.includes("prerequisiteEvidence.aiServiceStatusPath") &&
    extractedDeliveryIndexBuilder.includes("activeProvider=mock") &&
    extractedDeliveryIndexBuilder.includes("manualProviderAcceptance=false") &&
    extractedDeliveryIndexBuilder.includes("runtime-rollback-evidence");
  const deliveryIndexRuntimeRollbackVerifierReady =
    extractedDeliveryIndexVerifier.includes("runtimeRollbackEvidencePath?: string") &&
    extractedDeliveryIndexVerifier.includes("process_returned_release_approval_receipt") &&
    extractedDeliveryIndexVerifier.includes("runtime-rollback-evidence: `prerequisiteEvidence.aiServiceStatusPath`") &&
    extractedDeliveryIndexVerifier.includes("manualProviderAcceptance=false");
  const sourcePackageRuntimeRollbackChecklistReady =
    extractedUploadReadme.includes("prerequisiteEvidence.aiServiceStatusPath") &&
    extractedUploadReadme.includes("activeProvider=mock") &&
    extractedUploadReadme.includes("manualProviderAcceptance=false");
  push(
    checks,
    "Extracted delivery index tools expose release approval runtime rollback handoff",
    deliveryIndexRuntimeRollbackBuilderReady &&
      deliveryIndexRuntimeRollbackVerifierReady &&
      sourcePackageRuntimeRollbackChecklistReady,
    "builder=" +
      deliveryIndexRuntimeRollbackBuilderReady +
      "; verifier=" +
      deliveryIndexRuntimeRollbackVerifierReady +
      "; uploadReadme=" +
      sourcePackageRuntimeRollbackChecklistReady
  );

  push(
    checks,
    `Extracted delivery index tools preserve source-control handoff boundary`,
    extractedDeliveryIndexBuilder.includes(`sourceControlBoundary`) &&
      extractedDeliveryIndexBuilder.includes(`not_required_for_handoff`) &&
      extractedDeliveryIndexBuilder.includes(`archiveIsSourceOfTruth`) &&
      extractedDeliveryIndexBuilder.includes(`## Source Control Boundary`) &&
      extractedDeliveryIndexBuilder.includes(`new GitHub repository root`) &&
      extractedDeliveryIndexVerifier.includes(`sourceControlBoundary?:`) &&
      extractedDeliveryIndexVerifier.includes(`Delivery index declares source-control handoff boundary`) &&
      extractedDeliveryIndexVerifier.includes(`Archive is source of truth`) &&
      extractedDeliveryIndexVerifier.includes(`not a valid repository`),
    `builder=${extractedDeliveryIndexBuilder.includes(`sourceControlBoundary`)}; markdown=${extractedDeliveryIndexBuilder.includes(`## Source Control Boundary`)}; verifier=${extractedDeliveryIndexVerifier.includes(`Delivery index declares source-control handoff boundary`)}; archiveSource=${extractedDeliveryIndexVerifier.includes(`archiveIsSourceOfTruth`)}`
  );

  const deliveryIndexBuilderEvidenceConsistencyReady =
    extractedDeliveryIndexBuilder.includes(`sourcePackageEvidenceConsistent`) &&
    extractedDeliveryIndexBuilder.includes(`manifestArchivePath`) &&
    extractedDeliveryIndexBuilder.includes(`verificationArchivePath`) &&
    extractedDeliveryIndexBuilder.includes(`actualBytes`) &&
    extractedDeliveryIndexBuilder.includes(`mismatchReasons`) &&
    extractedDeliveryIndexBuilder.includes(`verification_older_than_manifest`) &&
    extractedDeliveryIndexBuilder.includes(`blocked_needs_current_source_package_verification`) &&
    extractedDeliveryIndexBuilder.includes(`Manifest/verification/archive consistent`);
  const deliveryIndexVerifierEvidenceConsistencyReady =
    extractedDeliveryIndexVerifier.includes(`sourcePackageEvidenceConsistent`) &&
    extractedDeliveryIndexVerifier.includes(`fileSize(sourceManifest?.archivePath`) &&
    extractedDeliveryIndexVerifier.includes(`index.finalArchive?.evidenceConsistent === true`) &&
    extractedDeliveryIndexVerifier.includes(`mismatchReasons?.length`) &&
    extractedDeliveryIndexVerifier.includes(`index.finalArchive.actualBytes === actualArchiveBytes`) &&
    extractedDeliveryIndexVerifier.includes(`Manifest/verification/archive consistent`);
  push(
    checks,
    `Extracted delivery index tools enforce source package evidence consistency`,
    deliveryIndexBuilderEvidenceConsistencyReady && deliveryIndexVerifierEvidenceConsistencyReady,
    `builder=${deliveryIndexBuilderEvidenceConsistencyReady}; verifier=${deliveryIndexVerifierEvidenceConsistencyReady}; staleGuard=${extractedDeliveryIndexBuilder.includes(`verification_older_than_manifest`)}; blockedStatus=${extractedDeliveryIndexBuilder.includes(`blocked_needs_current_source_package_verification`)}; markdown=${extractedDeliveryIndexBuilder.includes(`Manifest/verification/archive consistent`) && extractedDeliveryIndexVerifier.includes(`Manifest/verification/archive consistent`)}`
  );
  push(
    checks,
    `Extracted delivery index tools preserve new-repository bootstrap gate`,
    extractedDeliveryIndexBuilder.includes(`newRepositoryBootstrap`) &&
      extractedDeliveryIndexBuilder.includes(`## New Repository Bootstrap`) &&
      extractedDeliveryIndexBuilder.includes(`npm run verify:product -- --port 3110`) &&
      extractedDeliveryIndexBuilder.includes(`http://127.0.0.1:3000/api/health`) &&
      extractedDeliveryIndexBuilder.includes(`product_health_json_v1`) &&
      extractedDeliveryIndexBuilder.includes(`packageManagerVersion`) &&
      extractedDeliveryIndexBuilder.includes(`packageJson?.packageManager`) &&
      extractedDeliveryIndexBuilder.includes(`runtimePrerequisites`) &&
      extractedDeliveryIndexBuilder.includes(`npm run ci:productization`) &&
      extractedDeliveryIndexVerifier.includes(`newRepositoryBootstrap?:`) &&
      extractedDeliveryIndexVerifier.includes(`Delivery index declares new-repository bootstrap commands`) &&
      extractedDeliveryIndexVerifier.includes(`package-lock.json`) &&
      extractedDeliveryIndexVerifier.includes(`node -e "require('node:fs').copyFileSync('.env.example','.env')"`) &&
      extractedDeliveryIndexVerifier.includes(`Copy-Item .env.example .env`) &&
      extractedDeliveryIndexVerifier.includes(`cp .env.example .env`) &&
      extractedDeliveryIndexVerifier.includes(`packageManagerVersion === packageJson?.packageManager`) &&
      extractedDeliveryIndexVerifier.includes(`runtimePrerequisites?.node === packageJson?.engines?.node`) &&
      extractedDeliveryIndexVerifier.includes(`product_health_json_v1`),
    `builder=${extractedDeliveryIndexBuilder.includes(`newRepositoryBootstrap`)}; markdown=${extractedDeliveryIndexBuilder.includes(`## New Repository Bootstrap`)}; verifier=${extractedDeliveryIndexVerifier.includes(`Delivery index declares new-repository bootstrap commands`)}; packageManager=${extractedDeliveryIndexBuilder.includes(`packageManagerVersion`) && extractedDeliveryIndexBuilder.includes(`packageJson?.packageManager`)}; runtime=${extractedDeliveryIndexBuilder.includes(`runtimePrerequisites`)}; node=${extractedDeliveryIndexVerifier.includes(`>=22 <25`)}; health=${extractedDeliveryIndexVerifier.includes(`product_health_json_v1`)}`
  );


  const extractedProductizationCi = extractedPackageJson?.scripts?.["ci:productization:gates"];
  push(
    checks,
    "Extracted productization CI gates refresh human, real-model, and tester preflights before final source packaging",
    scriptHasProductizationGates(extractedProductizationCi) && productizationCiUsesSelfVerifiedPreflightOrder(extractedProductizationCi),
    `humanPreflightBeforeReviewer=${
      extractedProductizationCi?.includes(
        "npm run verify:human-acceptance-return-intake && npm run verify:real-model-trial-return-intake && npm run verify:product-release-readiness -- --allow-blocked && npm run preflight:human-acceptance -- --base-url http://127.0.0.1:3000"
      ) ?? false
    }; realModelTrialPrep=${
      extractedProductizationCi?.includes("npm run verify:product-release-blocker-board && npm run verify:real-model-adapter-contract && npm run build:real-model-trial-kit && npm run verify:real-model-trial-kit && npm run build:real-model-trial-receipt-template && npm run verify:real-model-trial-receipt && npm run build:product-operator-brief") ?? false
    }; packageTrialAudit=${
      extractedProductizationCi?.includes("npm run package:product-trial && npm run verify:product-trial") ?? false
    }; livePreflightBeforePublicBeta=${
      extractedProductizationCi?.includes(
        "npm run preflight:public-beta-tester -- --base-url http://127.0.0.1:3000 && npm run package:product-trial && npm run verify:product-trial && npm run package:public-beta"
      ) ?? false
    }; publicBetaSelfVerified=${
      extractedProductizationCi?.includes("npm run package:public-beta && npm run verify:public-beta") ?? false
    }; noFinalSourcePackaging=${
      !(extractedProductizationCi?.includes("npm run package:github-source") ?? false) &&
      !(extractedProductizationCi?.includes("npm run verify:github-source") ?? false)
    }; hiddenPublicBetaTrialPrereq=${
      extractedProductizationCi?.includes("npm run package:public-beta && npm run verify:product-trial") ?? false
    }`
  );

  push(
    checks,
    "Extracted local productization CI packages staged takeover-entry scan before final source archive",
    extractedProductizationRunner.includes("stage GitHub source package after local CI receipt") &&
      extractedProductizationRunner.includes("verify takeover entry against staged GitHub source package") &&
      extractedProductizationRunner.includes("rebuild final GitHub source package after staged takeover entry scan") &&
      extractedTakeoverEntryConsistency?.responseMode === "product_takeover_entry_consistency_verification_json_v1" &&
      extractedTakeoverEntryConsistency.status === "passed" &&
      extractedTakeoverEntryConsistency.passed === extractedTakeoverEntryConsistency.total &&
      Number(extractedTakeoverEntryConsistency.total ?? 0) >= 10 &&
      Number(extractedTakeoverEntryConsistency.checkedTargets?.length ?? 0) >= 14 &&
      Number(extractedTakeoverEntryConsistency.skippedStaleOptionalTargets?.length ?? 1) === 0 &&
      timestampMs(extractedTakeoverEntryConsistency.generatedAt) <= timestampMs(manifest?.generatedAt) &&
      extractedTakeoverEntryConsistency.releaseDecision === "do_not_release" &&
      extractedTakeoverEntryConsistency.allSoftwareObjective === "paused" &&
      extractedTakeoverEntryConsistency.accepted === false &&
      extractedTakeoverEntryConsistency.packagingGated === true &&
      extractedTakeoverEntryConsistency.canRelease === false,
    `runnerStage=${extractedProductizationRunner.includes("stage GitHub source package after local CI receipt")}; runnerScan=${extractedProductizationRunner.includes(
      "verify takeover entry against staged GitHub source package"
    )}; status=${extractedTakeoverEntryConsistency?.status ?? "missing"}; checks=${extractedTakeoverEntryConsistency?.passed ?? "?"}/${
      extractedTakeoverEntryConsistency?.total ?? "?"
    }; targets=${extractedTakeoverEntryConsistency?.checkedTargets?.length ?? 0}; skipped=${
      extractedTakeoverEntryConsistency?.skippedStaleOptionalTargets?.length ?? "missing"
    }; receipt=${extractedTakeoverEntryConsistency?.generatedAt ?? "missing"}; manifest=${manifest?.generatedAt ?? "missing"}`
  );
  push(
    checks,
    "Extracted takeover matrix is ready and locked",
    extractedTakeoverMatrix?.responseMode === "product_takeover_decision_matrix_json_v1" &&
      extractedTakeoverMatrix.status === "ready_for_takeover" &&
      extractedTakeoverMatrix.releaseDecision === "do_not_release" &&
      extractedTakeoverMatrix.allSoftwareObjective === "paused" &&
      extractedTakeoverMatrix.reviewOnly === true &&
      extractedTakeoverMatrix.accepted === false &&
      extractedTakeoverMatrix.packagingGated === true &&
      extractedTakeoverMatrix.canRelease === false &&
      extractedTakeoverMatrix.canActivateRealModel === false &&
      Number(extractedTakeoverMatrix.allowedActions?.length ?? 0) >= 7 &&
      extractedTakeoverMatrix.allowedActions?.every((action) => action.allowed === true) === true &&
      extractedTakeoverMatrix.allowedActions?.some((action) => action.id === "invite_one_bounded_beta_tester" && action.allowed === true) === true &&
      extractedTakeoverMatrix.allowedActions?.some(
        (action) => action.id === "process_returned_real_model_trial_receipt" && action.allowed === true
      ) === true &&
      extractedTakeoverMatrix.allowedActions?.some(
        (action) => action.id === "process_returned_release_approval_receipt" && action.allowed === true
      ) === true &&
      extractedTakeoverMatrix.blockedActions?.some((action) => action.id === "release_product" && action.blocked === true) === true,
    `status=${extractedTakeoverMatrix?.status ?? "missing"}; release=${
      extractedTakeoverMatrix?.releaseDecision ?? "missing"
    }; allowed=${extractedTakeoverMatrix?.allowedActions?.length ?? 0}; blocked=${
      extractedTakeoverMatrix?.blockedActions?.length ?? 0
    }`
  );
  push(
    checks,
    "Extracted first-read handoff docs preserve real-model redaction stop conditions",
    extractedTakeoverMatrix?.allowedActions?.some(
      (action) =>
        action.id === "plan_real_model_trial_without_activation" &&
        action.evidencePath === "artifacts/productization/real-model-trial-kit.md" &&
        action.redactionChecklistPath === "artifacts/productization/real-model-trial-kit.md#credential-redaction-checklist" &&
        action.stopCondition?.includes("credential redaction checklist") === true &&
        action.stopCondition?.includes("rollback_to_mock_after_trial") === true &&
        action.stopCondition?.includes("returned artifacts contain secrets") === true
    ) === true &&
      extractedTakeoverMatrixMarkdown.includes("artifacts/productization/real-model-trial-kit.md#credential-redaction-checklist") &&
      extractedTakeoverMatrixMarkdown.includes("rollback_to_mock_after_trial") &&
      extractedTakeoverMatrixMarkdown.includes("returned artifacts contain secrets") &&
      extractedLaunchChecklistMarkdown.includes("artifacts/productization/real-model-trial-kit.md#credential-redaction-checklist") &&
      extractedLaunchChecklistMarkdown.includes("rollback_to_mock_after_trial") &&
      extractedLaunchChecklistMarkdown.includes("returned artifacts contain secrets"),
    `action=${extractedTakeoverMatrix?.allowedActions?.some((action) => action.id === "plan_real_model_trial_without_activation" && action.redactionChecklistPath === "artifacts/productization/real-model-trial-kit.md#credential-redaction-checklist") ?? false}; takeover=${extractedTakeoverMatrixMarkdown.includes("rollback_to_mock_after_trial")}; launch=${extractedLaunchChecklistMarkdown.includes("rollback_to_mock_after_trial")}`
  );

  push(
    checks,
    "Extracted project takeover assessment is current and self-staling safe",
    extractedProjectTakeoverAssessment.includes("Bounded core teaching-loop productization candidate") &&
      extractedProjectTakeoverAssessment.includes("product-delivery-index.json") &&
      extractedProjectTakeoverAssessment.includes("self-staling zip filename or SHA") &&
      !/transparent-ai-apprentice-mcp-github-source-\\d{4}-\\d{2}-\\d{2}T[0-9-]+Z\\.zip/.test(extractedProjectTakeoverAssessment) &&
      !/sha256:\\s*[0-9a-f]{64}/i.test(extractedProjectTakeoverAssessment) &&
      extractedProjectTakeoverAssessmentVerification?.responseMode === "project_takeover_assessment_verification_json_v1" &&
      extractedProjectTakeoverAssessmentVerification.status === "passed" &&
      extractedProjectTakeoverAssessmentVerification.passed === extractedProjectTakeoverAssessmentVerification.total &&
      Number(extractedProjectTakeoverAssessmentVerification.total ?? 0) >= 9 &&
      extractedProjectTakeoverAssessmentVerification.releaseDecision === "do_not_release" &&
      extractedProjectTakeoverAssessmentVerification.allSoftwareObjective === "paused" &&
      extractedProjectTakeoverAssessmentVerification.accepted === false &&
      extractedProjectTakeoverAssessmentVerification.packagingGated === true &&
      extractedProjectTakeoverAssessmentVerification.canRelease === false &&
      extractedProjectTakeoverAssessmentVerification.canActivateRealModel === false,
    `bytes=${extractedProjectTakeoverAssessment.length}; verifier=${extractedProjectTakeoverAssessmentVerification?.status ?? "missing"} ${extractedProjectTakeoverAssessmentVerification?.passed ?? "?"}/${extractedProjectTakeoverAssessmentVerification?.total ?? "?"}`
  );
  push(
    checks,
    "Extracted status summary preserves beta-not-release boundary",
    extractedStatusSummary?.responseMode === "product_status_summary_json_v1" &&
      extractedStatusSummary.status === "ready_for_bounded_beta_not_release" &&
      extractedStatusSummary.betaCanStart === true &&
      extractedStatusSummary.canRelease === false &&
      extractedStatusSummary.canActivateRealModel === false &&
      extractedStatusSummary.accepted === false &&
      extractedStatusSummary.packagingGated === true &&
      extractedStatusSummary.releaseDecision === "do_not_release" &&
      extractedStatusSummary.allSoftwareObjective === "paused",
    `status=${extractedStatusSummary?.status ?? "missing"}; beta=${
      extractedStatusSummary?.betaCanStart ?? "missing"
    }; canRelease=${extractedStatusSummary?.canRelease ?? "missing"}; model=${
      extractedStatusSummary?.canActivateRealModel ?? "missing"
    }`
  );

  push(
    checks,
    "Extracted public beta packet is ready and bounded",
    extractedPublicBetaManifest?.responseMode === "public_beta_packet_manifest_json_v1" &&
      extractedPublicBetaManifest.status === "ready_for_public_beta" &&
      extractedPublicBetaManifest.betaCanStart === true &&
      extractedPublicBetaManifest.requiredPassed === extractedPublicBetaManifest.requiredTotal &&
      Number(extractedPublicBetaManifest.requiredTotal ?? 0) >= 29 &&
      extractedPublicBetaManifest.releaseDecision === "do_not_release" &&
      extractedPublicBetaManifest.allSoftwareObjective === "paused",
    `status=${extractedPublicBetaManifest?.status ?? "missing"}; required=${
      extractedPublicBetaManifest?.requiredPassed ?? "?"
    }/${extractedPublicBetaManifest?.requiredTotal ?? "?"}; release=${
      extractedPublicBetaManifest?.releaseDecision ?? "missing"
    }`
  );

  push(
    checks,
    "Extracted public beta tester invite keeps whole-session receipt with facilitator",
    fileExistsWithSize(
      path.join(extractDir, "artifacts", "productization", "public-beta-packet", "docs", "PUBLIC_BETA_TESTER_INVITE.md"),
      1000
    ) &&
      extractedPublicBetaTesterInvite.includes("Send the tester") &&
      extractedPublicBetaTesterInvite.includes("PUBLIC_BETA_FEEDBACK_RECEIPT.template.json") &&
      extractedPublicBetaTesterInvite.includes("keep docs/PUBLIC_BETA_SESSION_RECEIPT.template.json with the facilitator/maintainer") &&
      !extractedPublicBetaTesterInvite.includes("return both JSON receipts"),
    `send=${extractedPublicBetaTesterInvite.includes("Send the tester")}; feedback=${extractedPublicBetaTesterInvite.includes(
      "PUBLIC_BETA_FEEDBACK_RECEIPT.template.json"
    )}; facilitator=${extractedPublicBetaTesterInvite.includes(
      "keep docs/PUBLIC_BETA_SESSION_RECEIPT.template.json with the facilitator/maintainer"
    )}; noBoth=${!extractedPublicBetaTesterInvite.includes("return both JSON receipts")}`
  );

  push(
    checks,
    "Extracted public beta return materials expose receipt binding rule",
    extractedStartPublicBeta.includes("same tester.name/tester.date") &&
    extractedStartPublicBeta.includes("sessionEvidence.feedbackReceiptPath") &&
      extractedPublicBetaSessionPlan.includes("Receipt Binding Rule") &&
      extractedPublicBetaSessionPlan.includes("same tester.name and tester.date") &&
      extractedPublicBetaSessionPlan.includes("sessionEvidence.feedbackReceiptPath") &&
      extractedPublicBetaSessionPlan.includes("intake rejects mismatches"),
    `start=${extractedStartPublicBeta.includes("same tester.name/tester.date")}; plan=${extractedPublicBetaSessionPlan.includes(
      "same tester.name and tester.date"
    )}; mismatch=${extractedPublicBetaSessionPlan.includes("intake rejects mismatches")}`
  );

  push(
    checks,
    "Extracted first-real tester send materials preserve SHA-256 fingerprint gate",
    extractedFirstRealTesterSendBundle?.responseMode === "first_real_tester_send_bundle_json_v1" &&
      extractedFirstRealTesterSendBundle.status === "ready_to_send_chosen_lane" &&
      extractedFirstRealTesterSendBundle.selectedLane?.id === "public_beta_tester_session" &&
      extractedFirstRealTesterSendBundle.releaseDecision === "do_not_release" &&
      extractedFirstRealTesterSendBundle.accepted === false &&
      extractedFirstRealTesterSendBundle.packagingGated === true &&
      extractedFirstRealTesterSendBundle.canRelease === false &&
      extractedFirstRealTesterSendBundle.canActivateRealModel === false &&
      extractedFirstRealTesterSendBundle.actualSendPerformed === false &&
      (extractedFirstRealTesterSendBundle.sendFiles?.length ?? 0) >= 3 &&
      (extractedFirstRealTesterSendBundle.returnFiles?.length ?? 0) >= 2 &&
      (extractedFirstRealTesterSendBundle.sendFiles ?? []).every(extractedBundleFingerprintMatches) &&
      (extractedFirstRealTesterSendBundle.returnFiles ?? []).every(extractedBundleFingerprintMatches) &&
      extractedFirstRealTesterSendBundleVerification?.status === "passed" &&
      extractedFirstRealTesterSendBundleVerification.passed === extractedFirstRealTesterSendBundleVerification.total &&
      Number(extractedFirstRealTesterSendBundleVerification.total ?? 0) >= 9 &&
      extractedFirstRealTesterSendBundleVerification.checks?.some((check) => check.name === "Declared send bundle fingerprints match disk files" && check.pass === true) === true &&
      extractedFirstRealTesterContactReadiness?.status === 'ready_to_contact_first_external_person' &&
      extractedFirstRealTesterContactReadiness.contactAllowed === true &&
      extractedFirstRealTesterContactReadiness.contactDecision === 'may_contact_exactly_one_person' &&
      extractedFirstRealTesterContactReadiness.selectedLane?.id === 'public_beta_tester_session' &&
      extractedFirstRealTesterContactReadiness.releaseDecision === 'do_not_release' &&
      extractedFirstRealTesterContactReadiness.accepted === false &&
      extractedFirstRealTesterContactReadiness.packagingGated === true &&
      extractedFirstRealTesterContactReadiness.canRelease === false &&
      extractedFirstRealTesterContactReadiness.canActivateRealModel === false &&
      extractedFirstRealTesterContactReadinessVerification?.status === 'passed' &&
      extractedFirstRealTesterContactReadinessVerification.passed === extractedFirstRealTesterContactReadinessVerification.total &&
      Number(extractedFirstRealTesterContactReadinessVerification.total ?? 0) >= 7 &&
      extractedFirstRealTesterContactReadinessVerification.contactAllowed === true &&
      extractedFirstRealTesterContactReadinessMarkdown.includes('Contact allowed:') &&
      extractedFirstRealTesterContactReadinessMarkdown.includes('false') &&
      extractedFirstRealTesterSendExecutionBrief?.status === "ready_for_manual_send_execution" &&
      extractedFirstRealTesterSendExecutionBrief.manualSendAllowed === true &&
      extractedFirstRealTesterSendExecutionBrief.actualSendPerformed === false &&
      extractedFirstRealTesterSendExecutionBrief.releaseDecision === "do_not_release" &&
      extractedFirstRealTesterSendExecutionBrief.accepted === false &&
      extractedFirstRealTesterSendExecutionBrief.packagingGated === true &&
      extractedFirstRealTesterSendExecutionBrief.canRelease === false &&
      extractedFirstRealTesterSendExecutionBrief.canActivateRealModel === false &&
      extractedFirstRealTesterSendExecutionBriefVerification?.status === "passed" &&
      extractedFirstRealTesterSendExecutionBriefVerification.passed === extractedFirstRealTesterSendExecutionBriefVerification.total &&
      extractedFirstRealTesterSendExecutionBriefVerification.manualSendAllowed === true &&
      extractedFirstRealTesterSendExecutionBriefVerification.actualSendPerformed === false &&
      extractedFirstRealTesterSendExecutionBriefMarkdown.includes("Manual send allowed: `true`") &&
      extractedFirstRealTesterSendExecutionBriefMarkdown.includes("Actual send performed: `false`") &&
      extractedFirstRealTesterSendReceiptTemplate?.status === "template_ready" &&
      extractedFirstRealTesterSendReceiptTemplate.defaultDecision === "not_sent_yet" &&
      extractedFirstRealTesterSendReceiptTemplate.releaseDecision === "do_not_release" &&
      extractedFirstRealTesterSendReceiptTemplate.accepted === false &&
      extractedFirstRealTesterSendReceiptTemplate.packagingGated === true &&
      extractedFirstRealTesterSendReceiptTemplate.canRelease === false &&
      extractedFirstRealTesterSendReceiptTemplate.canActivateRealModel === false &&
      (extractedFirstRealTesterSendReceiptTemplate.receiptFields?.sentMaterials ?? []).every(extractedReceiptFingerprintMatches) &&
      (extractedFirstRealTesterSendReceiptTemplate.receiptFields?.retainedByMaintainer ?? []).every(extractedReceiptFingerprintMatches) &&
      extractedFirstRealTesterSendReceiptTemplateVerification?.status === "passed" &&
      extractedFirstRealTesterSendReceiptTemplateVerification.passed === extractedFirstRealTesterSendReceiptTemplateVerification.total &&
      Number(extractedFirstRealTesterSendReceiptTemplateVerification.total ?? 0) >= 9 &&
      extractedFirstRealTesterSendBundleMarkdown.includes("sha256") &&
      extractedFirstRealTesterSendReceiptTemplateMarkdown.includes("expected sha256") &&
      extractedSendBundleVerifierScript.includes("declaredFilesMatchFingerprints") &&
      extractedSendBundleVerifierScript.includes("fileSha256") &&
      extractedSendReceiptVerifierScript.includes("expectedSha256") &&
      extractedSendReceiptVerifierScript.includes("bundledFileSha256") &&
      extractedFirstRealTesterReturnWorkbench?.status === "ready_to_process_exactly_one_first_return" &&
      extractedFirstRealTesterReturnWorkbench.releaseDecision === "do_not_release" &&
      extractedFirstRealTesterReturnWorkbench.accepted === false &&
      extractedFirstRealTesterReturnWorkbench.packagingGated === true &&
      extractedFirstRealTesterReturnWorkbench.canRelease === false &&
      extractedFirstRealTesterReturnWorkbench.canActivateRealModel === false &&
      extractedFirstRealTesterReturnWorkbench.sendReceiptHandoff?.requiredBeforeReturnIntake === true &&
      extractedFirstRealTesterReturnWorkbench.sendReceiptHandoff.sendBundleFingerprintGate === "sha256-bound" &&
      extractedFirstRealTesterReturnWorkbench.sendReceiptHandoff.submittedSendReceiptValidation?.includes("not_submitted_yet") === true &&
      extractedFirstRealTesterReturnWorkbench.sendReceiptHandoff.validationCommand ===
        "npm run verify:first-real-tester-send-receipt-template -- --receipt <filled-send-receipt-path>" &&
      extractedFirstRealTesterReturnWorkbench.sendReceiptHandoff.validationEvidencePath ===
        "artifacts/productization/first-real-tester-send-receipt-validation.json" &&
      extractedFirstRealTesterReturnWorkbenchVerification?.status === "passed" &&
      extractedFirstRealTesterReturnWorkbenchVerification.passed === extractedFirstRealTesterReturnWorkbenchVerification.total &&
      Number(extractedFirstRealTesterReturnWorkbenchVerification.total ?? 0) >= 8 &&
      extractedFirstRealTesterReturnWorkbenchVerification.checks?.some(
        (check) => check.name === "Return workbench binds return intake to verified send receipt handoff" && check.pass === true
      ) === true &&
      extractedFirstRealTesterReturnWorkbenchMarkdown.includes("Send Receipt Handoff") &&
      extractedFirstRealTesterReturnWorkbenchMarkdown.includes("first-real-tester-send-receipt-validation.json") &&
      extractedReturnWorkbenchVerifierScript.includes("Return workbench binds return intake to verified send receipt handoff"),
    `bundle=${extractedFirstRealTesterSendBundleVerification?.status ?? "missing"} ${extractedFirstRealTesterSendBundleVerification?.passed ?? "?"}/${extractedFirstRealTesterSendBundleVerification?.total ?? "?"}; receipt=${extractedFirstRealTesterSendReceiptTemplateVerification?.status ?? "missing"} ${extractedFirstRealTesterSendReceiptTemplateVerification?.passed ?? "?"}/${extractedFirstRealTesterSendReceiptTemplateVerification?.total ?? "?"}; returnWorkbench=${extractedFirstRealTesterReturnWorkbenchVerification?.status ?? "missing"} ${extractedFirstRealTesterReturnWorkbenchVerification?.passed ?? "?"}/${extractedFirstRealTesterReturnWorkbenchVerification?.total ?? "?"}; sendFingerprints=${(extractedFirstRealTesterSendBundle?.sendFiles ?? []).map((file) => `${file.bundlePath}:${(file.sha256 ?? "missing").slice(0, 12)}`).join(",")}; receiptSha=${(extractedFirstRealTesterSendReceiptTemplate?.receiptFields?.sentMaterials ?? []).map((file) => `${file.bundlePath}:${(file.expectedSha256 ?? "missing").slice(0, 12)}`).join(",")}`
  );

  push(
    checks,
    "Extracted first real tester final go/no-go gate is packaged and locked",
    copiedDestinations.has("artifacts/productization/first-real-tester-final-go-no-go.json") &&
      copiedDestinations.has("artifacts/productization/first-real-tester-final-go-no-go.md") &&
      copiedDestinations.has("artifacts/productization/first-real-tester-final-go-no-go-verification.json") &&
      extractedPackageJson?.scripts?.["build:first-real-tester-final-go-no-go"] === "tsx scripts/build-first-real-tester-final-go-no-go.ts" &&
      extractedPackageJson.scripts?.["verify:first-real-tester-final-go-no-go"] === "tsx scripts/verify-first-real-tester-final-go-no-go.ts" &&
      extractedPackageJson.scripts?.["ci:productization:gates"]?.includes("npm run build:first-real-tester-final-go-no-go") === true &&
      extractedPackageJson.scripts?.["ci:productization:gates"]?.includes("npm run verify:first-real-tester-final-go-no-go") === true &&
      extractedFirstRealTesterFinalGoNoGo?.responseMode === "first_real_tester_final_go_no_go_json_v1" &&
      extractedFirstRealTesterFinalGoNoGo.status === "ready_for_one_manual_send" &&
      extractedFirstRealTesterFinalGoNoGo.selectedLane === "public_beta_tester_session" &&
      extractedFirstRealTesterFinalGoNoGo.releaseDecision === "do_not_release" &&
      extractedFirstRealTesterFinalGoNoGo.allSoftwareObjective === "paused" &&
      extractedFirstRealTesterFinalGoNoGo.reviewOnly === true &&
      extractedFirstRealTesterFinalGoNoGo.accepted === false &&
      extractedFirstRealTesterFinalGoNoGo.packagingGated === true &&
      extractedFirstRealTesterFinalGoNoGo.canRelease === false &&
      extractedFirstRealTesterFinalGoNoGo.canActivateRealModel === false &&
      extractedFirstRealTesterFinalGoNoGo.manualSendAllowed === true &&
      extractedFirstRealTesterFinalGoNoGo.actualSendPerformed === false &&
      extractedFirstRealTesterFinalGoNoGo.externalSendFolder ===
        "artifacts/productization/first-real-tester-send-bundle/SEND_TO_FIRST_EXTERNAL_PERSON" &&
      extractedFirstRealTesterFinalGoNoGo.validationEvidencePath ===
        "artifacts/productization/first-real-tester-send-receipt-validation.json" &&
      extractedFirstRealTesterFinalGoNoGo.returnGatePath === "artifacts/productization/first-real-tester-return-gate.md" &&
      (extractedFirstRealTesterFinalGoNoGo.failedRequiredChecks ?? []).length === 0 &&
      (extractedFirstRealTesterFinalGoNoGo.checks ?? []).length >= 8 &&
      (extractedFirstRealTesterFinalGoNoGo.checks ?? []).every((check) => check.pass === true && check.requiredForGo === true) &&
      extractedFirstRealTesterFinalGoNoGo.operatorFinalAssertions?.some((item) => item.includes("Do not invite anyone else")) === true &&
      extractedFirstRealTesterFinalGoNoGoVerification?.responseMode === "first_real_tester_final_go_no_go_verification_json_v1" &&
      extractedFirstRealTesterFinalGoNoGoVerification.status === "passed" &&
      extractedFirstRealTesterFinalGoNoGoVerification.passed === extractedFirstRealTesterFinalGoNoGoVerification.total &&
      Number(extractedFirstRealTesterFinalGoNoGoVerification.total ?? 0) >= 8 &&
      extractedFirstRealTesterFinalGoNoGoVerification.releaseDecision === "do_not_release" &&
      extractedFirstRealTesterFinalGoNoGoVerification.allSoftwareObjective === "paused" &&
      extractedFirstRealTesterFinalGoNoGoVerification.reviewOnly === true &&
      extractedFirstRealTesterFinalGoNoGoVerification.accepted === false &&
      extractedFirstRealTesterFinalGoNoGoVerification.packagingGated === true &&
      extractedFirstRealTesterFinalGoNoGoVerification.canRelease === false &&
      extractedFirstRealTesterFinalGoNoGoVerification.canActivateRealModel === false &&
      extractedFirstRealTesterFinalGoNoGoVerification.manualSendAllowed === true &&
      extractedFirstRealTesterFinalGoNoGoVerification.actualSendPerformed === false &&
      extractedFirstRealTesterFinalGoNoGoVerification.checks?.some(
        (check) => check.name === "Final go/no-go sends only the external folder and keeps all source states unsent" && check.pass === true
      ) === true &&
      extractedFirstRealTesterFinalGoNoGoVerification.checks?.some(
        (check) => check.name === "Final go/no-go keeps first return and widening gated" && check.pass === true
      ) === true &&
      fileExistsWithSize(path.join(extractDir, "artifacts", "productization", "first-real-tester-final-go-no-go.md"), 1000) &&
      extractedFirstRealTesterFinalGoNoGoMarkdown.includes("Status: `ready_for_one_manual_send`") &&
      extractedFirstRealTesterFinalGoNoGoMarkdown.includes("Manual send allowed: `true`") &&
      extractedFirstRealTesterFinalGoNoGoMarkdown.includes("Actual send performed: `false`") &&
      extractedFirstRealTesterFinalGoNoGoMarkdown.includes("SEND_TO_FIRST_EXTERNAL_PERSON") &&
      extractedFirstRealTesterFinalGoNoGoMarkdown.includes("first-real-tester-send-receipt-validation.json") &&
      extractedFirstRealTesterFinalGoNoGoMarkdown.includes("Do not invite anyone else") &&
      extractedFinalGoNoGoBuilderScript.includes("ready_for_one_manual_send") &&
      extractedFinalGoNoGoBuilderScript.includes("blocked_before_manual_send") &&
      extractedFinalGoNoGoBuilderScript.includes("requiredForGo") &&
      extractedFinalGoNoGoVerifierScript.includes("Final go/no-go sends only the external folder") &&
      extractedFinalGoNoGoVerifierScript.includes("first-real-tester-send-receipt-validation.json") &&
      extractedUploadReadme.includes("first-real-tester-final-go-no-go.md") &&
      extractedUploadReadme.includes("npm run build:first-real-tester-final-go-no-go") &&
      extractedUploadReadme.includes("npm run verify:first-real-tester-final-go-no-go"),
    `declared=${copiedDestinations.has("artifacts/productization/first-real-tester-final-go-no-go.json")}/${copiedDestinations.has(
      "artifacts/productization/first-real-tester-final-go-no-go.md"
    )}/${copiedDestinations.has("artifacts/productization/first-real-tester-final-go-no-go-verification.json")}; status=${extractedFirstRealTesterFinalGoNoGo?.status ?? "missing"}; manual=${extractedFirstRealTesterFinalGoNoGo?.manualSendAllowed ?? "missing"}; actualSend=${extractedFirstRealTesterFinalGoNoGo?.actualSendPerformed ?? "missing"}; verification=${extractedFirstRealTesterFinalGoNoGoVerification?.status ?? "missing"} ${extractedFirstRealTesterFinalGoNoGoVerification?.passed ?? "?"}/${extractedFirstRealTesterFinalGoNoGoVerification?.total ?? "?"}; readme=${extractedUploadReadme.includes("first-real-tester-final-go-no-go.md")}`
  );
  push(
    checks,
    'Extracted human acceptance receipt requires artifact-backed gate verification',
    extractedHumanAcceptanceReceiptTemplate?.gateVerification?.gateReportPath ===
      'artifacts/productization/human-acceptance-gate.json' &&
      extractedHumanAcceptanceReceiptTemplate.gateVerification.command === 'npm run verify:human-acceptance' &&
      extractedHumanAcceptanceReceiptTemplate.gateVerification.latestHumanReviewed === null &&
      extractedPacketHumanAcceptanceReceiptTemplate?.gateVerification?.gateReportPath ===
        'artifacts/productization/human-acceptance-gate.json' &&
      extractedPacketHumanAcceptanceReceiptTemplate.gateVerification.command === 'npm run verify:human-acceptance' &&
      extractedHumanAcceptanceReceiptVerifier.includes('Submitted human acceptance gate is artifact-backed and passed') &&
      extractedHumanAcceptanceReceiptVerifier.includes('isHumanAcceptanceGatePassed'),
    'rootGatePath=' +
      (extractedHumanAcceptanceReceiptTemplate?.gateVerification?.gateReportPath ?? 'missing') +
      '; packetGatePath=' +
      (extractedPacketHumanAcceptanceReceiptTemplate?.gateVerification?.gateReportPath ?? 'missing') +
      '; verifierGateCheck=' +
      extractedHumanAcceptanceReceiptVerifier.includes('Submitted human acceptance gate is artifact-backed and passed')
  );


  const rootLocalCiVerificationExists = rootLocalCiVerification?.responseMode === "productization_ci_local_verification_json_v1";
  const manifestMs = timestampMs(manifest?.generatedAt);
  const localCiVerificationMs = timestampMs(rootLocalCiVerification?.generatedAt);
  push(
    checks,
    "GitHub source package is newer than local productization CI verification when present",
    !rootLocalCiVerificationExists ||
      (Number.isFinite(manifestMs) && Number.isFinite(localCiVerificationMs) && manifestMs >= localCiVerificationMs),
    `root=${rootLocalCiVerificationExists}; manifest=${manifest?.generatedAt ?? "missing"}; localCiVerification=${
      rootLocalCiVerification?.generatedAt ?? "missing"
    }`
  );
  push(
    checks,
    "Local productization CI evidence is packaged when present",
    !rootLocalCiVerificationExists ||
      (copiedDestinations.has("artifacts/productization/productization-ci-local.json") &&
        copiedDestinations.has("artifacts/productization/productization-ci-local-verification.json") &&
        extractedLocalCiReceipt?.responseMode === "productization_ci_local_receipt_json_v1" &&
        extractedLocalCiReceipt.status === "passed" &&
        extractedLocalCiReceipt.releaseDecision === "do_not_release" &&
        extractedLocalCiReceipt.accepted === false &&
        extractedLocalCiReceipt.packagingGated === true &&
        extractedLocalCiVerification?.responseMode === "productization_ci_local_verification_json_v1" &&
        extractedLocalCiVerification.status === "passed" &&
        extractedLocalCiVerification.passed === extractedLocalCiVerification.total &&
        extractedLocalCiVerification.releaseDecision === "do_not_release" &&
        extractedLocalCiVerification.accepted === false &&
        extractedLocalCiVerification.packagingGated === true),
    `root=${rootLocalCiVerificationExists}; receiptPackaged=${copiedDestinations.has(
      "artifacts/productization/productization-ci-local.json"
    )}; verificationPackaged=${copiedDestinations.has(
      "artifacts/productization/productization-ci-local-verification.json"
    )}; extractedReceipt=${extractedLocalCiReceipt?.status ?? "missing"}; extractedVerification=${
      extractedLocalCiVerification?.status ?? "missing"
    } ${extractedLocalCiVerification?.passed ?? "?"}/${extractedLocalCiVerification?.total ?? "?"}`
  );
  push(
    checks,
    "Extracted public beta entry documents product trial evidence sync",
    fileExistsWithSize(path.join(extractDir, "artifacts", "productization", "public-beta-packet", "START_PUBLIC_BETA.md"), 1000) &&
      extractedStartPublicBeta.includes("npm run package:public-beta") &&
      extractedStartPublicBeta.includes("ensures the product trial packet has") &&
      extractedStartPublicBeta.includes("Use `npm run verify:product-trial` only") &&
      extractedStartPublicBeta.includes("npm run verify:public-beta") &&
      extractedStartPublicBeta.includes("evidence/product-trial-manifest.json") &&
      extractedStartPublicBeta.includes("evidence/product-trial-packet-verification.json") &&
      extractedStartPublicBeta.includes("embeds it in the beta packet") &&
      extractedPublicBetaReadiness?.responseMode === "public_beta_readiness_receipt_json_v1" &&
      extractedPublicBetaReadiness.status === "passed" &&
      extractedPublicBetaReadiness.passed === extractedPublicBetaReadiness.total &&
      Number(extractedPublicBetaReadiness.total ?? 0) >= 46 &&
      extractedPublicBetaInstructionCheck?.pass === true &&
      extractedPublicBetaInstructionCheck.evidence?.includes("productTrialDocs=true/true") === true &&
      extractedPublicBetaInstructionCheck.evidence.includes("productTrialAuto=true") &&
      extractedPublicBetaInstructionCheck.evidence.includes("productTrialAudit=true") &&
      extractedPublicBetaInstructionCheck.evidence.includes("publicBetaVerifier=true") &&
      extractedProductTrialVerificationCheck?.pass === true &&
      /checks=([1-9][0-9]*)\/\1/.test(extractedProductTrialVerificationCheck.evidence ?? "") &&
      (extractedProductTrialVerificationCheck.evidence ?? "").includes("current=true") &&
      (extractedProductTrialVerificationCheck.evidence ?? "").includes("packaged=true"),
    `startDoc=${fileExistsWithSize(
      path.join(extractDir, "artifacts", "productization", "public-beta-packet", "START_PUBLIC_BETA.md"),
      1000
    )}; productTrialDocs=${extractedStartPublicBeta.includes("evidence/product-trial-manifest.json")}/${extractedStartPublicBeta.includes(
      "evidence/product-trial-packet-verification.json"
    )}; productTrialAuto=${extractedStartPublicBeta.includes("ensures the product trial packet has")}; productTrialAudit=${extractedStartPublicBeta.includes("Use `npm run verify:product-trial` only")}; publicBetaVerifier=${extractedStartPublicBeta.includes("npm run verify:public-beta")}; readiness=${extractedPublicBetaReadiness?.status ?? "missing"} ${extractedPublicBetaReadiness?.passed ?? "?"}/${
      extractedPublicBetaReadiness?.total ?? "?"
    }; instructionEvidence=${extractedPublicBetaInstructionCheck?.evidence ?? "missing"}; trialEvidence=${
      extractedProductTrialVerificationCheck?.evidence ?? "missing"
    }`
  );
  push(
    checks,
    "Upload checklist includes first-run and lock verification steps",
    manifest?.uploadChecklist?.some((item) => item.includes("npm run verify:new-repo-bootstrap") && item.includes("before npm install")) === true &&
      manifest.uploadChecklist.some((item) => item.includes("npm install")) === true &&
      manifest.uploadChecklist.some((item) => item.includes(`Node >=22 <25`) && item.includes(`npm >=10`) && item.includes(`package.json#engines`)) &&
      manifest.uploadChecklist.some((item) => item.includes("npm run typecheck")) &&
      manifest.uploadChecklist.some((item) => item.includes("npm run test")) &&
      manifest.uploadChecklist.some((item) => item.includes("npm run verify:product")) &&
      manifest.uploadChecklist.some((item) => item.includes("npm run verify:product-release-readiness -- --allow-blocked")) &&
      manifest.uploadChecklist.some((item) => item.includes("npm run build:product-release-blocker-board")) &&
      manifest.uploadChecklist.some((item) => item.includes("npm run verify:product-release-blocker-board")) &&
      manifest.uploadChecklist.some((item) => item.includes("npm run build:product-status-summary")) &&
      manifest.uploadChecklist.some((item) => item.includes("npm run verify:product-status-summary")) &&
      manifest.uploadChecklist.some((item) => item.includes("npm run build:product-takeover-matrix")) &&
      manifest.uploadChecklist.some((item) => item.includes("npm run verify:product-takeover-matrix")) &&
      phraseOrder(
        (manifest.uploadChecklist ?? []).join("\n"),
        "npm run build:product-takeover-matrix and npm run verify:product-takeover-matrix",
        "npm run build:productization-launch-checklist and npm run verify:productization-launch-checklist"
      ) &&
      phraseOrder(
        (manifest.uploadChecklist ?? []).join("\n"),
        "npm run build:productization-launch-checklist and npm run verify:productization-launch-checklist",
        "npm run verify:productization-evidence-freshness"
      ) &&
      manifest.uploadChecklist.some((item) => item.includes("npm run verify:productization-evidence-freshness")) &&
      manifest.uploadChecklist.some((item) => item.includes("npm run audit:productization-lock-coverage")) &&
      manifest.uploadChecklist.some((item) => item.includes("npm run verify:product-takeover-entry")) &&
      manifest.uploadChecklist.some((item) => item.includes("npm run verify:project-takeover-assessment")) &&
      manifest.uploadChecklist.some((item) => item.includes("stages the GitHub source package") && item.includes("verifies takeover-entry consistency against staged docs")) &&
      manifest.uploadChecklist.some((item) => item.includes("npm run verify:product-trial")) &&
      manifest.uploadChecklist.some((item) => item.includes("npm run build:productization-launch-checklist")) &&
      manifest.uploadChecklist.some((item) => item.includes("npm run verify:productization-launch-checklist")) &&
      manifest.uploadChecklist.some((item) => item.includes("npm run build:product-operator-brief")) &&
      manifest.uploadChecklist.some((item) => item.includes("npm run verify:product-operator-brief")) &&
      manifest.uploadChecklist.some((item) => item.includes("npm run verify:public-beta")) &&
      manifest.uploadChecklist.some((item) => item.includes("npm run build:human-acceptance-reviewer-invite")) &&
      manifest.uploadChecklist.some((item) => item.includes("npm run verify:human-acceptance-reviewer-invite")) &&
      manifest.uploadChecklist.some((item) => item.includes("npm run intake:human-acceptance-return -- --receipt <path> --send-receipt-validation artifacts/productization/first-real-tester-send-receipt-validation.json")) &&
      manifest.uploadChecklist.some((item) => item.includes("npm run verify:human-acceptance-return-intake")) &&
      manifest.uploadChecklist.some((item) => item.includes("postIntakeRefresh.commandSequence")) &&
      manifest.uploadChecklist.some(
        (item) =>
          item.includes("npm run intake:product-release-approval-return -- --receipt <path>") &&
          item.includes("npm run verify:product-release-approval-return-intake") &&
          item.includes("prerequisiteEvidence.aiServiceStatusPath") &&
          item.includes("activeProvider=mock") &&
          item.includes("manualProviderAcceptance=false")
      ) &&
      manifest.uploadChecklist.some(
        (item) =>
          item.includes("npm run intake:real-model-trial-return -- --receipt <path>") &&
          item.includes("npm run verify:real-model-trial-return-intake")
      ) &&
      manifest.uploadChecklist.some((item) => item.includes("npm run build:product-delivery-index")) &&
      manifest.uploadChecklist.some((item) => item.includes("npm run verify:product-delivery-index")) &&
      manifest.uploadChecklist.some((item) => item.includes("package.json#scripts command contract")) &&
      manifest.uploadChecklist.some((item) => item.includes(`archive SHA-256`)) &&
      manifest.uploadChecklist.some((item) => item.includes("npm run verify:github-source")) &&
      manifest.uploadChecklist.some((item) => item.includes("npm run ci:productization")) &&
      manifest.uploadChecklist.some((item) => item.includes("npm run verify:productization-ci-local")) &&
      manifest.uploadChecklist.some((item) => item.includes("npm run harden:productization-locks")) &&
      manifest.uploadChecklist.some((item) => item.includes("npm run audit:productization-lock-coverage")) &&
      manifest.uploadChecklist.some((item) => item.includes("npm run build:first-real-tester-launch") && item.includes("npm run verify:first-real-tester-launch") && item.includes("first real tester or reviewer")) &&
      manifest.uploadChecklist.some((item) => item.includes("npm run build:first-real-tester-send-bundle") && item.includes("npm run verify:first-real-tester-send-bundle") && item.includes("SEND_TO_FIRST_EXTERNAL_PERSON") && item.includes("SHA-256")) &&
      manifest.uploadChecklist.some((item) => item.includes("npm run build:first-real-tester-contact-readiness") && item.includes("npm run verify:first-real-tester-contact-readiness") && item.includes("contactAllowed=true")) &&
      manifest.uploadChecklist.some((item) => item.includes("npm run build:first-real-tester-send-execution-brief") && item.includes("npm run verify:first-real-tester-send-execution-brief") && item.includes("first-real-tester-send-execution-brief.md") && item.includes("manualSendAllowed=true") && item.includes("actualSendPerformed=false")) &&
      manifest.uploadChecklist.some((item) => item.includes("npm run build:first-real-tester-send-receipt-template") && item.includes("npm run verify:first-real-tester-send-receipt-template") && item.includes("first-real-tester-send-receipt-template.md") && item.includes("expectedSha256") && item.includes("failedChecks") && item.includes("remediationActions") && item.includes("nextAction")) &&
      manifest.uploadChecklist.some((item) => item.includes("npm run build:first-real-tester-final-go-no-go") && item.includes("npm run verify:first-real-tester-final-go-no-go") && item.includes("first-real-tester-final-go-no-go.md") && item.includes("manualSendAllowed=true")) &&
      manifest.uploadChecklist.some((item) => item.includes("npm run build:first-real-tester-return-workbench") && item.includes("npm run verify:first-real-tester-return-workbench") && item.includes("npm run build:first-real-tester-return-gate") && item.includes("npm run verify:first-real-tester-return-gate") && item.includes("first-real-tester-send-receipt-validation.json") && item.includes("before inviting anyone else")) &&
      extractedUploadReadme.includes("npm run build:first-real-tester-launch") &&
      extractedUploadReadme.includes("npm run build:first-real-tester-send-bundle") &&
      extractedUploadReadme.includes("npm run verify:first-real-tester-send-bundle") &&
      extractedUploadReadme.includes("npm run build:first-real-tester-contact-readiness") &&
      extractedUploadReadme.includes("npm run verify:first-real-tester-contact-readiness") &&
      extractedUploadReadme.includes("npm run build:first-real-tester-send-execution-brief") &&
      extractedUploadReadme.includes("npm run verify:first-real-tester-send-execution-brief") &&
      extractedUploadReadme.includes("npm run build:first-real-tester-send-receipt-template") &&
      extractedUploadReadme.includes("npm run verify:first-real-tester-send-receipt-template") &&
      extractedUploadReadme.includes("npm run build:first-real-tester-final-go-no-go") &&
      extractedUploadReadme.includes("npm run verify:first-real-tester-final-go-no-go") &&
      numberedListIsSequential(extractedUploadReadme, "## First Files To Read", "## What is included", 15) &&
      numberedListIsSequential(extractedUploadReadme, "## After Extracting Or Uploading To GitHub", "## Release Boundary", 37) &&
      extractedUploadReadme.includes("npm run build:first-real-tester-return-workbench") &&
      extractedUploadReadme.includes("npm run build:first-real-tester-return-gate") &&
      extractedUploadReadme.includes("first-real-tester-launch.md") &&
      extractedUploadReadme.includes("first-real-tester-dispatch-packet/START_FIRST_REAL_TESTER.md") &&
      extractedUploadReadme.includes("first-real-tester-send-bundle.md") &&
      extractedUploadReadme.includes("first-real-tester-send-bundle/SEND_TO_FIRST_EXTERNAL_PERSON") &&
      extractedUploadReadme.includes("SHA-256") &&
      extractedUploadReadme.includes("first-real-tester-send-execution-brief.md") &&
      extractedUploadReadme.includes("manualSendAllowed=true") &&
      extractedUploadReadme.includes("actualSendPerformed=false") &&
      extractedUploadReadme.includes("first-real-tester-send-receipt-template.md") &&
      extractedUploadReadme.includes("expectedSha256") &&
      extractedUploadReadme.includes("failedChecks") &&
      extractedUploadReadme.includes("remediationActions") &&
      extractedUploadReadme.includes("nextAction") &&
      extractedUploadReadme.includes("first-real-tester-return-workbench.md") &&
      extractedUploadReadme.includes("first-real-tester-send-receipt-validation.json") &&
      extractedUploadReadme.includes("Send Receipt Handoff") &&
      extractedUploadReadme.includes("first-real-tester-return-gate.md") &&
      manifest.uploadChecklist.some((item) => item.includes("product server")) &&
      manifest.uploadChecklist.some((item) => item.includes("/api/health")) &&
      manifest.uploadChecklist.some((item) => item.includes("PUBLIC_BETA_SESSION_PLAN.md")) &&
      manifest.uploadChecklist.some((item) => item.includes("PUBLIC_BETA_SESSION_RECEIPT.template.json")) &&
      manifest.uploadChecklist.some((item) => item.includes("npm run verify:public-beta-session-receipt -- --receipt <path>")) &&
      manifest.uploadChecklist.some((item) => item.includes("PUBLIC_BETA_TESTER_RUNBOOK.md")) &&
      manifest.uploadChecklist.some((item) => item.includes("npm run verify:public-beta-feedback -- --receipt <path>")) &&
      manifest.uploadChecklist.some(
        (item) =>
          item.includes("npm run intake:public-beta-return -- --receipt <path> --session-receipt <session-receipt-path> --send-receipt-validation artifacts/productization/first-real-tester-send-receipt-validation.json") &&
          item.includes("first-real-tester-send-receipt-validation.json") &&
          item.includes("tester.name/tester.date") &&
          item.includes("sessionEvidence.feedbackReceiptPath")
      ) &&
      manifest.uploadChecklist.some((item) => item.includes(`node -e`) && item.includes(`Copy-Item .env.example .env`) && item.includes(`cp .env.example .env`)) &&
      extractedUploadReadme.includes(`node -e `) &&
      extractedUploadReadme.includes(`Copy-Item .env.example .env`) &&
      extractedUploadReadme.includes(`cp .env.example .env`) &&
      manifest.uploadChecklist.some((item) => item.includes("Productization CI")),
    `items=${manifest?.uploadChecklist?.length ?? 0}; firstFilesNumbered=${numberedListIsSequential(extractedUploadReadme, "## First Files To Read", "## What is included", 15)}; afterExtractingNumbered=${numberedListIsSequential(extractedUploadReadme, "## After Extracting Or Uploading To GitHub", "## Release Boundary", 37)}; runtime=${manifest?.uploadChecklist?.some((item) => item.includes(`Node >=22 <25`) && item.includes(`npm >=10`)) ?? false}; commandContract=${manifest?.uploadChecklist?.some((item) => item.includes("package.json#scripts command contract")) ?? false}; archiveSha256=${manifest?.uploadChecklist?.some((item) => item.includes(`archive SHA-256`)) ?? false}; envCrossPlatform=${manifest?.uploadChecklist?.some((item) => item.includes(`node -e`) && item.includes(`Copy-Item .env.example .env`) && item.includes(`cp .env.example .env`)) ?? false}; betaBinding=${manifest?.uploadChecklist?.some((item) => item.includes("tester.name/tester.date") && item.includes("sessionEvidence.feedbackReceiptPath")) ?? false}; firstRealLaunch=${manifest?.uploadChecklist?.some((item) => item.includes("npm run build:first-real-tester-launch") && item.includes("npm run verify:first-real-tester-launch")) ?? false}; sendBundle=${manifest?.uploadChecklist?.some((item) => item.includes("npm run build:first-real-tester-send-bundle") && item.includes("SEND_TO_FIRST_EXTERNAL_PERSON") && item.includes("SHA-256")) ?? false}; sendReceipt=${manifest?.uploadChecklist?.some((item) => item.includes("npm run build:first-real-tester-send-receipt-template") && item.includes("first-real-tester-send-receipt-template.md") && item.includes("expectedSha256") && item.includes("remediationActions")) ?? false}; finalGoNoGo=${manifest?.uploadChecklist?.some((item) => item.includes("npm run build:first-real-tester-final-go-no-go") && item.includes("first-real-tester-final-go-no-go.md") && item.includes("manualSendAllowed=true")) ?? false}; takeoverBeforeLaunch=${phraseOrder(
      (manifest?.uploadChecklist ?? []).join("\n"),
      "npm run build:product-takeover-matrix and npm run verify:product-takeover-matrix",
      "npm run build:productization-launch-checklist and npm run verify:productization-launch-checklist"
    )}; launchBeforeFreshness=${phraseOrder(
      (manifest?.uploadChecklist ?? []).join("\n"),
      "npm run build:productization-launch-checklist and npm run verify:productization-launch-checklist",
      "npm run verify:productization-evidence-freshness"
    )}`
  );

  fs.rmSync(extractDir, { recursive: true, force: true });

  const passed = checks.filter((check) => check.pass).length;
  const receipt = {
    responseMode: "github_source_package_verification_json_v1",
    status: passed === checks.length ? "passed" : "failed",
    generatedAt: new Date().toISOString(),
    command: "npm run verify:github-source",
    archivePath: manifest?.archivePath ?? "missing",
    archiveSha256: manifest?.archiveSha256 ?? "missing",
    releaseDecision: "do_not_release",
    allSoftwareObjective: "paused",
    uploadReady: passed === checks.length,
    includesSecrets: false,
    includesDependencies: false,
    includesLocalDatabase: false,
    includesBuildCache: false,
    passed,
    total: checks.length,
    checks,
    nextAction:
      passed === checks.length
        ? "Upload or hand off the verified GitHub source zip, then run the included GITHUB_UPLOAD_README checklist after checkout."
        : "Fix failed source package checks, rerun npm run package:github-source, then rerun npm run verify:github-source."
  };

  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}
`, "utf8");
  console.log(JSON.stringify(receipt, null, 2));
  console.log(`
GitHub source package verification written to ${receiptPath}`);

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
