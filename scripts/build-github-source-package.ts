import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

type CopyResult = {
  source: string;
  destination: string;
  required: boolean;
  bytes: number;
};

type BootstrapReceipt = {
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
  generatedAt?: string;
};

const rootDir = process.cwd();
const outputDir = path.join(rootDir, "artifacts", "github-source-package");
const stagingDir = path.join(outputDir, "transparent-ai-apprentice-mcp");
const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const archiveName = `transparent-ai-apprentice-mcp-github-source-${timestamp}.zip`;
const archivePath = path.join(outputDir, archiveName);
const manifestPath = path.join(outputDir, "github-source-package-manifest.json");

const excludedTopLevel = new Set([
  ".agents",
  ".claude",
  ".cleanup-manifests",
  ".codex",
  ".git",
  ".next",
  ".rollback-points",
  ".ta",
  ".ta-smoke",
  ".transparent-apprentice",
  "artifacts",
  "coverage",
  "dist",
  "mcp-route-request-receipt-rollback",
  "node_modules",
  "tsx-andmin"
]);

const excludedFileNames = new Set([
  ".env",
  "dev.db",
  "dev.db-journal",
  "tsconfig.tsbuildinfo",
  "tsconfig.typecheck.tsbuildinfo"
]);

const excludedFilePatterns = [/^\.next-dev-.*\.log$/, /^\.product-.*\.log$/, /^\.qa-.*\.png$/];

const selectedEvidence = [
  "artifacts/productization/public-beta-packet",
  "artifacts/productization/product-trial-packet",
  "artifacts/productization/product-trial-packet-verification.json",
  "artifacts/productization/product-verification-receipt.json",
  "artifacts/productization/product-ui-api-smoke.json",
  "artifacts/productization/product-runtime-verification.json",
  "artifacts/productization/product-runtime-doctor.json",
  "artifacts/productization/runtime-artifact-cleanup.json",
  "artifacts/productization/live-product-handoff.json",
  "artifacts/productization/handoff-browser-smoke.json",
  "artifacts/productization/product-release-readiness.json",
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
  "artifacts/productization/productization-ci-local.json",
  "artifacts/productization/productization-ci-local-verification.json",
  "artifacts/productization/product-status-summary.json",
  "artifacts/productization/product-status-summary-verification.json",
  "artifacts/productization/product-status-summary.md",
  "artifacts/productization/product-operator-brief.json",
  "artifacts/productization/product-operator-brief-verification.json",
  "artifacts/productization/product-operator-brief.md",
  "artifacts/productization/product-takeover-decision-matrix.json",
  "artifacts/productization/product-takeover-decision-matrix-verification.json",
  "artifacts/productization/product-takeover-decision-matrix.md",
  "artifacts/productization/product-takeover-entry-consistency.json",
  "artifacts/productization/productization-launch-checklist.json",
  "artifacts/productization/productization-launch-checklist-verification.json",
  "artifacts/productization/productization-launch-checklist.md",
  "artifacts/productization/product-release-blocker-board.json",
  "artifacts/productization/product-release-blocker-board-verification.json",
  "artifacts/productization/product-release-blocker-board.md",
  "artifacts/productization/product-release-approval.template.json",
  "artifacts/productization/product-release-approval-template.md",
  "artifacts/productization/product-release-approval-validation.json",
  "artifacts/productization/product-release-approval-return-intake-verification.json",
  "artifacts/productization/product-release-approval-return-intake.json",
  "artifacts/productization/real-model-adapter-contract-verification.json",
  "artifacts/productization/real-model-trial-kit.json",
  "artifacts/productization/real-model-trial-kit-verification.json",
  "artifacts/productization/real-model-trial-kit.md",
  "artifacts/productization/real-model-trial-receipt.template.json",
  "artifacts/productization/real-model-trial-receipt-template.md",
  "artifacts/productization/real-model-trial-receipt-validation.json",
  "artifacts/productization/real-model-trial-return-intake-verification.json",
  "artifacts/productization/real-model-trial-return-intake.json",
  "artifacts/productization/human-acceptance-receipt.template.json",
  "artifacts/productization/human-acceptance-receipt-template.md",
  "artifacts/productization/human-acceptance-receipt-validation.json",
  "artifacts/productization/human-acceptance-return-intake.json",
  "artifacts/productization/human-acceptance-return-intake-verification.json",
  "artifacts/productization/product-handoff-readiness.json",
  "artifacts/productization/public-beta-readiness.json",
  "artifacts/productization/public-beta-feedback-receipt-validation.json",
  "artifacts/productization/public-beta-feedback-api-verification.json",
  "artifacts/productization/public-beta-feedback-collection.json",
  "artifacts/productization/public-beta-feedback-collection-verification.json",
  "artifacts/productization/public-beta-follow-up-plan.json",
  "artifacts/productization/public-beta-follow-up-plan-verification.json",
  "artifacts/productization/public-beta-tester-invite.json",
  "artifacts/productization/public-beta-tester-invite-verification.json",
  "artifacts/productization/public-beta-tester-invite.md",
  "artifacts/productization/public-beta-packet/docs/PUBLIC_BETA_TESTER_RUNBOOK.md",
  "artifacts/productization/public-beta-packet/docs/PUBLIC_BETA_SESSION_PLAN.md",
  "artifacts/productization/public-beta-packet/docs/PUBLIC_BETA_SESSION_RECEIPT.template.json",
  "artifacts/productization/public-beta-packet/docs/PUBLIC_BETA_SESSION_RECEIPT_TEMPLATE.md",
  "artifacts/productization/public-beta-session-receipt-validation.json",
  "artifacts/productization/public-beta-tester-session-preflight.json",
  "artifacts/productization/public-beta-return-intake-verification.json",
  "artifacts/productization/public-beta-preparation.json",
  "artifacts/productization/human-acceptance-gate.json",
  "artifacts/productization/human-acceptance-session-preflight.json",
  "artifacts/productization/human-acceptance-reviewer-kit.json",
  "artifacts/productization/human-acceptance-reviewer-kit-verification.json",
  "artifacts/productization/human-acceptance-reviewer-kit.md",
  "artifacts/productization/human-acceptance-reviewer-invite.json",
  "artifacts/productization/human-acceptance-reviewer-invite-verification.json",
  "artifacts/productization/human-acceptance-reviewer-invite.md",
  "artifacts/productization/manual-acceptance-classification-verification.json",
  "artifacts/productization/manual-acceptance-latest.json",
  "artifacts/productization/manual-acceptance-browser-smoke.json",
  "artifacts/productization/manual-acceptance-report.browser-smoke.json",
  "artifacts/productization/manual-acceptance-browser.png",
  "artifacts/productization/manual-acceptance-browser-desktop.png",
  "artifacts/productization/manual-acceptance-browser-mobile.png",
  "artifacts/productization/dashboard-product-entry.png",
  "artifacts/productization/handoff-beta-feedback-desktop.png",
  "artifacts/productization/handoff-beta-feedback-mobile.png",
  "artifacts/productization/smoke-record-cleanup.json"
];

const optionalSelectedEvidence = new Set([
  "artifacts/productization/human-acceptance-return-intake.json",
  "artifacts/productization/product-release-approval-return-intake.json",
  "artifacts/productization/real-model-trial-return-intake.json",
  "artifacts/productization/public-beta-tester-session-preflight.json",
  "artifacts/productization/productization-ci-local.json",
  "artifacts/productization/productization-ci-local-verification.json"
]);

function readJson<T>(relativePath: string): T | null {
  const fullPath = path.join(rootDir, relativePath);
  if (!fs.existsSync(fullPath)) return null;
  return JSON.parse(fs.readFileSync(fullPath, "utf8")) as T;
}

function fileExistsWithSize(relativePath: string, minimumBytes = 1) {
  const fullPath = path.join(rootDir, relativePath);
  return fs.existsSync(fullPath) && fs.statSync(fullPath).size >= minimumBytes;
}

function sha256File(targetPath: string) {
  return createHash("sha256").update(fs.readFileSync(targetPath)).digest("hex");
}

function timestampMs(value: string | undefined) {
  const parsed = Date.parse(value ?? "");
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function optionalRuntimeEvidenceIsFresh(relativePath: string) {
  if (relativePath !== "artifacts/productization/public-beta-tester-session-preflight.json") {
    return true;
  }

  const preflight = readJson<{ generatedAt?: string }>(relativePath);
  const freshness = readJson<{ generatedAt?: string }>("artifacts/productization/productization-evidence-freshness.json");
  const preflightMs = timestampMs(preflight?.generatedAt);
  const freshnessMs = timestampMs(freshness?.generatedAt);

  return Number.isFinite(preflightMs) && Number.isFinite(freshnessMs) && preflightMs >= freshnessMs;
}
function shouldExcludeEntry(relativePath: string, name: string, isDirectory: boolean): boolean {
  const normalized = relativePath.replaceAll("\\", "/");
  const topLevel = normalized.split("/")[0];
  if (excludedTopLevel.has(topLevel)) return true;
  if (!isDirectory && excludedFileNames.has(name)) return true;
  if (!isDirectory && excludedFilePatterns.some((pattern) => pattern.test(name))) return true;
  return false;
}

function directorySize(targetPath: string): number {
  if (!fs.existsSync(targetPath)) return 0;
  const stat = fs.statSync(targetPath);
  if (stat.isFile()) return stat.size;
  return fs
    .readdirSync(targetPath)
    .reduce((sum, entry) => sum + directorySize(path.join(targetPath, entry)), 0);
}

function copyRecursive(sourcePath: string, destinationPath: string, relativePath = ""): void {
  const stat = fs.statSync(sourcePath);
  const name = path.basename(sourcePath);
  if (shouldExcludeEntry(relativePath || name, name, stat.isDirectory())) return;

  if (stat.isDirectory()) {
    fs.mkdirSync(destinationPath, { recursive: true });
    for (const child of fs.readdirSync(sourcePath)) {
      copyRecursive(
        path.join(sourcePath, child),
        path.join(destinationPath, child),
        path.join(relativePath || name, child)
      );
    }
    return;
  }

  fs.mkdirSync(path.dirname(destinationPath), { recursive: true });
  fs.copyFileSync(sourcePath, destinationPath);
}

function copySelectedEvidenceRecursive(sourcePath: string, destinationPath: string): void {
  const stat = fs.statSync(sourcePath);
  if (stat.isDirectory()) {
    fs.mkdirSync(destinationPath, { recursive: true });
    for (const child of fs.readdirSync(sourcePath)) {
      copySelectedEvidenceRecursive(path.join(sourcePath, child), path.join(destinationPath, child));
    }
    return;
  }

  fs.mkdirSync(path.dirname(destinationPath), { recursive: true });
  fs.copyFileSync(sourcePath, destinationPath);
}

function copyRequired(relativePath: string, destinationRelativePath = relativePath): CopyResult {
  const sourcePath = path.join(rootDir, relativePath);
  const destinationPath = path.join(stagingDir, destinationRelativePath);
  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Required package source is missing: ${relativePath}`);
  }
  copySelectedEvidenceRecursive(sourcePath, destinationPath);
  return {
    source: relativePath,
    destination: destinationRelativePath,
    required: true,
    bytes: directorySize(destinationPath)
  };
}

function copySelectedEvidence(relativePath: string): CopyResult | null {
  const sourcePath = path.join(rootDir, relativePath);
  const required = !optionalSelectedEvidence.has(relativePath);

  if (!fs.existsSync(sourcePath)) {
    if (required) {
      throw new Error(`Required package source is missing: ${relativePath}`);
    }
    return null;
  }

  if (!required && !optionalRuntimeEvidenceIsFresh(relativePath)) {
    return null;
  }

  const destinationPath = path.join(stagingDir, relativePath);
  copySelectedEvidenceRecursive(sourcePath, destinationPath);
  return {
    source: relativePath,
    destination: relativePath,
    required,
    bytes: directorySize(destinationPath)
  };
}

function refreshTakeoverEntryReceiptForStaging(): CopyResult {
  const command = process.platform === "win32" ? "cmd.exe" : "npm";
  const args = process.platform === "win32"
    ? ["/c", "npm.cmd", "run", "verify:product-takeover-entry"]
    : ["run", "verify:product-takeover-entry"];
  const result = spawnSync(command, args, {
    cwd: rootDir,
    encoding: "utf8"
  });
  const receiptRelativePath = "artifacts/productization/product-takeover-entry-consistency.json";
  const sourcePath = path.join(rootDir, receiptRelativePath);
  const destinationPath = path.join(stagingDir, receiptRelativePath);
  const receipt = readJson<{
    responseMode?: string;
    status?: string;
    passed?: number;
    total?: number;
    skippedStaleOptionalTargets?: string[];
  }>(receiptRelativePath);

  if (
    result.status !== 0 ||
    receipt?.responseMode !== "product_takeover_entry_consistency_verification_json_v1" ||
    receipt.status !== "passed" ||
    receipt.passed !== receipt.total ||
    !Array.isArray(receipt.skippedStaleOptionalTargets) ||
    receipt.skippedStaleOptionalTargets.length !== 0
  ) {
    throw new Error(
      [
        "Takeover-entry verification failed after staging upload handoff docs.",
        `exit=${result.status ?? "missing"}`,
        `status=${receipt?.status ?? "missing"}`,
        `checks=${receipt?.passed ?? "?"}/${receipt?.total ?? "?"}`,
        `skipped=${receipt?.skippedStaleOptionalTargets?.length ?? "missing"}`,
        `stdout=${(result.stdout ?? "").trim().slice(0, 400) || "empty"}`,
        `stderr=${(result.stderr ?? result.error?.message ?? "").trim().slice(0, 400) || "empty"}`
      ].join(" ")
    );
  }

  fs.mkdirSync(path.dirname(destinationPath), { recursive: true });
  fs.copyFileSync(sourcePath, destinationPath);
  return {
    source: receiptRelativePath,
    destination: receiptRelativePath,
    required: true,
    bytes: fs.statSync(destinationPath).size
  };
}

function refreshProjectTakeoverAssessmentReceiptForStaging(): CopyResult {
  const command = process.platform === "win32" ? "cmd.exe" : "npm";
  const args = process.platform === "win32"
    ? ["/c", "npm.cmd", "run", "verify:project-takeover-assessment"]
    : ["run", "verify:project-takeover-assessment"];
  const result = spawnSync(command, args, {
    cwd: rootDir,
    encoding: "utf8"
  });
  const receiptRelativePath = "artifacts/productization/project-takeover-assessment-verification.json";
  const sourcePath = path.join(rootDir, receiptRelativePath);
  const destinationPath = path.join(stagingDir, receiptRelativePath);
  const receipt = readJson<{
    responseMode?: string;
    status?: string;
    passed?: number;
    total?: number;
    releaseDecision?: string;
    allSoftwareObjective?: string;
    accepted?: boolean;
    packagingGated?: boolean;
    canRelease?: boolean;
    canActivateRealModel?: boolean;
  }>(receiptRelativePath);

  if (
    result.status !== 0 ||
    receipt?.responseMode !== "project_takeover_assessment_verification_json_v1" ||
    receipt.status !== "passed" ||
    receipt.passed !== receipt.total ||
    Number(receipt.total ?? 0) < 9 ||
    receipt.releaseDecision !== "do_not_release" ||
    receipt.allSoftwareObjective !== "paused" ||
    receipt.accepted !== false ||
    receipt.packagingGated !== true ||
    receipt.canRelease !== false ||
    receipt.canActivateRealModel !== false
  ) {
    throw new Error(
      [
        "Project takeover assessment verification failed before source archive compression.",
        `exit=${result.status ?? "missing"}`,
        `status=${receipt?.status ?? "missing"}`,
        `checks=${receipt?.passed ?? "?"}/${receipt?.total ?? "?"}`,
        `stdout=${(result.stdout ?? "").trim().slice(0, 400) || "empty"}`,
        `stderr=${(result.stderr ?? result.error?.message ?? "").trim().slice(0, 400) || "empty"}`
      ].join(" ")
    );
  }

  fs.mkdirSync(path.dirname(destinationPath), { recursive: true });
  fs.copyFileSync(sourcePath, destinationPath);
  return {
    source: receiptRelativePath,
    destination: receiptRelativePath,
    required: true,
    bytes: fs.statSync(destinationPath).size
  };
}
function writeStagedBootstrapReceipt(): { receipt: BootstrapReceipt; generatedEvidence: CopyResult } {
  const scriptPath = path.join(stagingDir, "scripts", "verify-new-repository-bootstrap.mjs");
  const result = spawnSync(
    process.execPath,
    [scriptPath, "--root", stagingDir, "--write", "--json-only"],
    { cwd: stagingDir, encoding: "utf8" }
  );

  let receipt: BootstrapReceipt | null = null;
  try {
    receipt = JSON.parse(result.stdout || "null") as BootstrapReceipt | null;
  } catch {
    receipt = null;
  }

  if (
    result.status !== 0 ||
    receipt?.responseMode !== "new_repository_bootstrap_verification_json_v1" ||
    receipt.status !== "passed" ||
    receipt.passed !== receipt.total ||
    Number(receipt.total ?? 0) < 9 ||
    receipt.releaseDecision !== "do_not_release" ||
    receipt.allSoftwareObjective !== "paused" ||
    receipt.accepted !== false ||
    receipt.packagingGated !== true ||
    receipt.canRelease !== false ||
    receipt.canActivateRealModel !== false
  ) {
    throw new Error(
      [
        "Staged new-repository bootstrap verification failed before source archive compression.",
        `exit=${result.status ?? "missing"}`,
        `status=${receipt?.status ?? "missing"}`,
        `checks=${receipt?.passed ?? "?"}/${receipt?.total ?? "?"}`,
        `stdout=${(result.stdout ?? "").trim().slice(0, 400) || "empty"}`,
        `stderr=${(result.stderr ?? "").trim().slice(0, 400) || "empty"}`
      ].join(" ")
    );
  }

  const relativePath = "artifacts/productization/new-repository-bootstrap-verification.json";
  const receiptPath = path.join(stagingDir, relativePath);
  return {
    receipt,
    generatedEvidence: {
      source: "generated:verify-new-repo-bootstrap",
      destination: relativePath,
      required: true,
      bytes: fs.statSync(receiptPath).size
    }
  };
}

function writeUploadReadme(): void {
  const readme = `# Transparent AI Apprentice MCP - GitHub Source Package

This source package is prepared for GitHub upload and bounded public-beta testing. It is not a production release.

## First Files To Read

1. Open \`artifacts/productization/product-takeover-decision-matrix.md\` first to choose one allowed next action and see stop conditions.
2. Open \`artifacts/productization/productization-launch-checklist.md\` to confirm the controlled launch gate, live preflight, and blocked release transitions before contacting anyone.
3. Open \`artifacts/productization/first-real-tester-launch.md\` as the single-send handoff for exactly one bounded real tester or reviewer while release stays locked.
4. Open \`artifacts/productization/first-real-tester-dispatch-packet/START_FIRST_REAL_TESTER.md\` to choose exactly one first external lane; do not send release approval or real-model trial materials.
5. Open \`artifacts/productization/first-real-tester-send-bundle.md\` and confirm its SHA-256 fingerprints; do not contact anyone from it yet.
6. Run the selected live preflight, rebuild \`artifacts/productization/first-real-tester-contact-readiness.md\`, and contact exactly one external person only if \`contactAllowed=true\`; current blocked contact readiness means do not contact.
7. Open \`artifacts/productization/first-real-tester-send-execution-brief.md\` before the manual send; it must say \`manualSendAllowed=true\`, \`actualSendPerformed=false\`, and only \`SEND_TO_FIRST_EXTERNAL_PERSON\` is allowed for exactly one external person.
8. Open \`artifacts/productization/first-real-tester-send-receipt-template.md\` to record whether the maintainer has manually sent the external folder; default remains not sent and every material has expectedSha256. Then open \`artifacts/productization/first-real-tester-final-go-no-go.md\` as the last operator check immediately before exactly one manual send. Validate any filled send receipt with \`npm run verify:first-real-tester-send-receipt-template -- --receipt <path>\` before waiting for the first return; if validation fails, inspect \`failedChecks\`, follow \`remediationActions\`, and use \`nextAction\` before treating the send as recorded.
9. Open \`artifacts/productization/first-real-tester-return-workbench.md\` when the first tester or reviewer returns files; confirm the Send Receipt Handoff and \`first-real-tester-send-receipt-validation.json\` requirement before running lane intake.
10. Open \`artifacts/productization/first-real-tester-return-gate.md\` after the first return to decide whether another tester or reviewer is allowed.
11. Open \`artifacts/productization/product-status-summary.md\` for the current beta-ready but release-blocked status.
12. Open \`artifacts/productization/product-operator-brief.md\` for the concise maintainer handoff.
13. Open \`artifacts/productization/product-release-blocker-board.md\` for release blockers; do not treat beta readiness as release approval.
14. Open \`artifacts/productization/public-beta-packet/START_PUBLIC_BETA.md\` before starting a tester session.
15. Give \`artifacts/productization/public-beta-packet/docs/PUBLIC_BETA_SESSION_PLAN.md\` and \`artifacts/productization/public-beta-packet/docs/PUBLIC_BETA_SESSION_RECEIPT.template.json\` to the facilitator; give \`artifacts/productization/public-beta-packet/docs/PUBLIC_BETA_TESTER_RUNBOOK.md\` to the bounded beta tester as the clean session materials.

## What is included

- Application source, scripts, Prisma schema/seed setup, plugin source, and product docs.
- Public-beta packet and productization evidence under \`artifacts/productization/\`.
- GitHub Actions Productization CI workflow under \`.github/workflows/productization-ci.yml\`; it builds, starts, and health-checks the product runtime before productization gates.
- \`.env.example\` for local configuration.

## What is intentionally excluded

- \`.env\`, local SQLite databases, \`.git\`, \`.next\`, \`node_modules\`, runtime copies, caches, and local agent/tool state.

## After Extracting Or Uploading To GitHub

Before running commands, confirm Node \`>=22 <25\` and npm \`>=10\`; this matches \`package.json#engines\` and the Productization CI Node 22 workflow.

1. Run \`npm run verify:new-repo-bootstrap\` before \`npm install\`; it is dependency-free and checks the source-only handoff boundary, first-read docs, Productization CI workflow, and release locks.
2. Run \`npm install\`.
3. Create \`.env\` from \`.env.example\`: run \`node -e "require('node:fs').copyFileSync('.env.example','.env')"\` from any shell, or \`Copy-Item .env.example .env\` in PowerShell, or \`cp .env.example .env\` in bash.
4. Run \`npm run typecheck\`.
5. Run \`npm run test\`.
6. Run \`npm run verify:product -- --port 3110\`.
7. Start the product runtime with \`npm run start:product -- --hostname 127.0.0.1 --port 3000\`, then confirm \`http://127.0.0.1:3000/api/health\` reports \`product_health_json_v1\` and \`healthy\`.
8. Run \`npm run prepare:public-beta -- --base-url http://127.0.0.1:3000\`.
9. Run \`npm run smoke:public-beta-browser -- --base-url http://127.0.0.1:3000\` if you need fresh desktop/mobile visual evidence for the /public-beta tester entry and feedback builder.
10. Run \`npm run smoke:handoff-browser -- --base-url http://127.0.0.1:3000\` if you need fresh desktop/mobile visual evidence for the beta feedback return loop.
11. Run \`npm run preflight:public-beta-tester -- --base-url http://127.0.0.1:3000\` immediately before inviting one bounded tester.
12. After the tester session, validate the filled whole-session receipt with \`npm run verify:public-beta-session-receipt -- --receipt <path>\`; after the tester returns a filled public beta feedback receipt, run \`npm run verify:public-beta-feedback -- --receipt <path>\`, then \`npm run intake:public-beta-return -- --receipt <path> --session-receipt <session-receipt-path> --send-receipt-validation artifacts/productization/first-real-tester-send-receipt-validation.json\` before inviting another tester. The feedback and session receipts must share the same tester.name/tester.date, and the session receipt \`sessionEvidence.feedbackReceiptPath\` must point at the submitted feedback receipt.
13. Run \`npm run build:human-acceptance-reviewer-kit\` and \`npm run verify:human-acceptance-reviewer-kit\` before asking a real reviewer to save \`human_review\` evidence.
14. Run \`npm run build:human-acceptance-receipt-template\` and \`npm run verify:human-acceptance-receipt\`; validate a filled copy with \`-- --receipt <path>\`.
15. Run \`npm run build:human-acceptance-reviewer-invite\` and \`npm run verify:human-acceptance-reviewer-invite\` immediately before contacting one real reviewer; this creates sendable invite copy but does not claim acceptance.
16. When the reviewer returns a filled receipt, run \`npm run intake:human-acceptance-return -- --receipt <path> --send-receipt-validation artifacts/productization/first-real-tester-send-receipt-validation.json\`, then \`npm run verify:human-acceptance-return-intake\`; only after that verifier passes, run the intake receipt's \`postIntakeRefresh.commandSequence\` before relying on refreshed reviewer invite, blocker board, status summary, takeover matrix, or evidence freshness files.
17. Run \`npm run verify:product-release-readiness -- --allow-blocked\` to refresh the current release gate before any release blocker board, status summary, or operator brief.
18. Run \`npm run build:product-release-blocker-board\` and \`npm run verify:product-release-blocker-board\` before release follow-up planning.
19. Run \`npm run build:product-operator-brief\` and \`npm run verify:product-operator-brief\` to refresh the concise next-step handoff.
20. Run \`npm run build:product-status-summary\` and \`npm run verify:product-status-summary\` to refresh the companion product status page.
21. Run \`npm run build:product-takeover-matrix\` and \`npm run verify:product-takeover-matrix\` to refresh the first-read takeover decision matrix.
22. Run \`npm run build:productization-launch-checklist\` and \`npm run verify:productization-launch-checklist\` to refresh the controlled launch page before contacting testers or reviewers.
23. Run \`npm run verify:productization-evidence-freshness\` to prove the release gate, blocker board, operator brief, status summary, takeover matrix, and controlled launch checklist came from one coherent refresh sequence.
24. Run \`npm run harden:productization-locks\`, then \`npm run audit:productization-lock-coverage\` to add missing explicit top-level productization locks and verify there are no dangerous unlocks before packaging.
25. Run \`npm run build:first-real-tester-launch\`, \`npm run verify:first-real-tester-launch\`, \`npm run build:first-real-tester-dispatch-packet\`, \`npm run verify:first-real-tester-dispatch-packet\`, \`npm run build:first-real-tester-send-bundle\`, \`npm run verify:first-real-tester-send-bundle\`, \`npm run build:first-real-tester-contact-readiness\`, \`npm run verify:first-real-tester-contact-readiness\`, \`npm run build:first-real-tester-send-execution-brief\`, \`npm run verify:first-real-tester-send-execution-brief\`, \`npm run build:first-real-tester-send-receipt-template\`, \`npm run verify:first-real-tester-send-receipt-template\`, \`npm run build:first-real-tester-final-go-no-go\`, and \`npm run verify:first-real-tester-final-go-no-go\` before contacting the first real tester or reviewer; use \`artifacts/productization/first-real-tester-launch.md\` as the intent gate, \`artifacts/productization/first-real-tester-dispatch-packet/START_FIRST_REAL_TESTER.md\` as the lane decision packet, \`artifacts/productization/first-real-tester-send-bundle/SEND_TO_FIRST_EXTERNAL_PERSON\` as the only external send folder, require the send bundle SHA-256 fingerprints to verify, require first-real-tester-contact-readiness.md to say contactAllowed=true after the selected live preflight, open \`artifacts/productization/first-real-tester-send-execution-brief.md\` and require manualSendAllowed=true with actualSendPerformed=false before the manual send, use \`artifacts/productization/first-real-tester-send-receipt-template.md\` with expectedSha256 to record manual send state while release stays locked, and require \`artifacts/productization/first-real-tester-final-go-no-go.md\` to say manualSendAllowed=true immediately before the manual send; validate a filled copy with \`npm run verify:first-real-tester-send-receipt-template -- --receipt <path>\`; if validation fails, inspect \`failedChecks\`, follow \`remediationActions\`, and use \`nextAction\` before treating the send as recorded.
26. Run \`npm run build:first-real-tester-return-workbench\`, \`npm run verify:first-real-tester-return-workbench\`, \`npm run build:first-real-tester-return-gate\`, and \`npm run verify:first-real-tester-return-gate\` after any first tester or reviewer return and before inviting anyone else; use \`artifacts/productization/first-real-tester-return-workbench.md\` for intake triage, confirm its Send Receipt Handoff requires \`first-real-tester-send-receipt-validation.json\` before lane intake when a manual send occurred, and use \`artifacts/productization/first-real-tester-return-gate.md\` as the widening gate.
27. Run \`npm run verify:product-takeover-entry\` to prove maintainer handoff docs and packets still put the takeover matrix before the status summary.
28. Run \`npm run verify:product-trial\` after rebuilding the trial packet so its embedded verification receipt matches the current handoff bundle.
29. Run \`npm run build:product-release-approval-template\` and \`npm run verify:product-release-approval\`; process a filled copy with \`npm run intake:product-release-approval-return -- --receipt <path>\` only after human and model acceptance evidence exists. The filled release approval receipt must include \`prerequisiteEvidence.aiServiceStatusPath\` pointing to post-trial \`GET /api/ai-service-status\` JSON proving \`activeProvider=mock\`, \`realModelReady=false\`, \`manualProviderAcceptance=false\`, \`accepted=false\`, and \`packagingGated=true\`; then run \`npm run verify:product-release-approval-return-intake\` before relying on separate release-review evidence.
30. Run \`npm run verify:real-model-adapter-contract\`, then \`npm run build:real-model-trial-kit\` and \`npm run verify:real-model-trial-kit\` before any real provider trial.
31. Open \`artifacts/productization/real-model-trial-kit.md#credential-redaction-checklist\` and confirm \`redacted_environment_summary\`, \`artifact_secret_scan_before_return\`, \`trial_log_minimization\`, and \`rollback_to_mock_after_trial\` before any real provider credential is used; stop if any returned artifact contains a secret or rollback to mock is not confirmed.
32. Run \`npm run build:real-model-trial-receipt-template\` and \`npm run verify:real-model-trial-receipt\`; process a filled copy with \`npm run intake:real-model-trial-return -- --receipt <path>\`, then run \`npm run verify:real-model-trial-return-intake\` before relying on real-provider trial evidence.
33. Run \`npm run verify:public-beta\`.
34. Run \`npm run build:product-delivery-index\` and \`npm run verify:product-delivery-index\` after the GitHub source package verifier passes to create the outer handoff pointer to the verified archive, including its \`package.json#scripts\` command contract and archive SHA-256.
35. Run \`npm run ci:productization\` as the self-contained local gate before handing off a checkout; it builds, starts or reuses the selected host/port, waits for \`/api/health\`, runs the bounded productization gates against the same base URL, refreshes both live human-acceptance and public-beta tester preflights, validates the durable local CI receipt, stages the GitHub source package, verifies takeover-entry consistency against staged docs, rebuilds/verifies the final GitHub source package with that receipt, runs the dependency-free new-repository bootstrap check, then builds/verifies the product delivery index. GitHub Actions runs \`ci:productization:gates\` only after \`/api/health\` is healthy.
36. When refreshing the GitHub upload zip separately from the full local CI, run \`npm run verify:productization-ci-local\`, \`npm run build:first-real-tester-launch\`, \`npm run verify:first-real-tester-launch\`, \`npm run build:first-real-tester-dispatch-packet\`, \`npm run verify:first-real-tester-dispatch-packet\`, \`npm run build:first-real-tester-send-bundle\`, \`npm run verify:first-real-tester-send-bundle\`, \`npm run build:first-real-tester-contact-readiness\`, \`npm run verify:first-real-tester-contact-readiness\`, \`npm run build:first-real-tester-send-execution-brief\`, \`npm run verify:first-real-tester-send-execution-brief\`, \`npm run build:first-real-tester-send-receipt-template\`, \`npm run verify:first-real-tester-send-receipt-template\`, \`npm run build:first-real-tester-final-go-no-go\`, \`npm run verify:first-real-tester-final-go-no-go\`, \`npm run build:first-real-tester-return-workbench\`, \`npm run verify:first-real-tester-return-workbench\`, \`npm run build:first-real-tester-return-gate\`, \`npm run verify:first-real-tester-return-gate\`, \`npm run package:github-source\`, \`npm run verify:product-takeover-entry\`, \`npm run package:github-source\`, \`npm run verify:github-source\`, \`npm run verify:new-repo-bootstrap -- --root artifacts/github-source-package/transparent-ai-apprentice-mcp\`, \`npm run build:product-delivery-index\`, and \`npm run verify:product-delivery-index\`; confirm the archive SHA-256 remains in the source verification and delivery index.
37. After uploading to GitHub, confirm the Productization CI workflow passes, including the \`/api/health\` product runtime check, before inviting a tester from that checkout.
## Release Boundary

- The current public-beta packet is ready for bounded core-loop testing.
- \`releaseDecision\` remains \`do_not_release\`.
- \`accepted=false\` and \`packagingGated=true\` remain expected until real human acceptance, real-model acceptance, and packaging approval are explicit.
- Do not resume the all-software objective from this package; \`allSoftwareObjective=paused\` is intentional.
`;
  fs.writeFileSync(path.join(stagingDir, "GITHUB_UPLOAD_README.md"), readme, "utf8");
}
function compressStagingDirectory(): void {
  if (fs.existsSync(archivePath)) fs.rmSync(archivePath, { force: true });
  const command = [
    "$ErrorActionPreference = 'Stop'",
    "$items = Get-ChildItem -LiteralPath $env:SOURCE_DIR -Force",
    "if (-not $items) { throw \"No package files found in $env:SOURCE_DIR\" }",
    "Compress-Archive -LiteralPath $items.FullName -DestinationPath $env:ARCHIVE_PATH -Force",
    "if (-not (Test-Path -LiteralPath $env:ARCHIVE_PATH)) { throw \"Archive was not created at $env:ARCHIVE_PATH\" }"
  ].join("; ");
  const result = spawnSync(
    "powershell",
    ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", command],
    {
      cwd: rootDir,
      env: {
        ...process.env,
        SOURCE_DIR: stagingDir,
        ARCHIVE_PATH: archivePath
      },
      encoding: "utf8"
    }
  );
  if (result.status !== 0) {
    throw new Error(`Compress-Archive failed:
${result.stdout}
${result.stderr}`);
  }
  if (!fs.existsSync(archivePath) || fs.statSync(archivePath).size <= 0) {
    throw new Error(
      [
        `Compress-Archive completed without creating a usable archive at ${archivePath}.`,
        `stdout=${result.stdout.trim() || "empty"}`,
        `stderr=${result.stderr.trim() || "empty"}`
      ].join("\n")
    );
  }
}
function assertNoForbiddenPayload(): string[] {
  const forbidden = [
    ".env",
    "node_modules",
    ".next",
    ".git",
    "prisma/dev.db",
    "prisma/dev.db-journal",
    "artifacts/productization/runtime"
  ];
  const violations: string[] = [];

  function walk(targetPath: string): void {
    for (const entry of fs.readdirSync(targetPath, { withFileTypes: true })) {
      const fullPath = path.join(targetPath, entry.name);
      const relative = path.relative(stagingDir, fullPath).replaceAll("\\", "/");
      if (forbidden.some((item) => relative === item || relative.startsWith(`${item}/`))) {
        violations.push(relative);
      }
      if (entry.isDirectory()) walk(fullPath);
    }
  }

  walk(stagingDir);
  return violations;
}

function main(): void {
  fs.rmSync(stagingDir, { recursive: true, force: true });
  fs.mkdirSync(stagingDir, { recursive: true });

  const copiedTopLevel: CopyResult[] = [];
  for (const entry of fs.readdirSync(rootDir, { withFileTypes: true })) {
    const relativePath = entry.name;
    if (shouldExcludeEntry(relativePath, entry.name, entry.isDirectory())) continue;
    copyRecursive(path.join(rootDir, entry.name), path.join(stagingDir, entry.name), relativePath);
    copiedTopLevel.push({
      source: relativePath,
      destination: relativePath,
      required: true,
      bytes: directorySize(path.join(stagingDir, entry.name))
    });
  }

  const copiedEvidence = selectedEvidence
    .map((relativePath) => copySelectedEvidence(relativePath))
    .filter((result): result is CopyResult => Boolean(result));
  writeUploadReadme();
  const refreshedTakeoverEntry = refreshTakeoverEntryReceiptForStaging();
  const refreshedAssessment = refreshProjectTakeoverAssessmentReceiptForStaging();
  const stagedBootstrap = writeStagedBootstrapReceipt();
  const generatedEvidence = [refreshedTakeoverEntry, refreshedAssessment, stagedBootstrap.generatedEvidence];

  const violations = assertNoForbiddenPayload();
  if (violations.length > 0) {
    throw new Error(`Forbidden files were staged:
${violations.join("\n")}`);
  }

  compressStagingDirectory();

  const betaManifest = readJson<{
    status?: string;
    betaCanStart?: boolean;
    requiredPassed?: number;
    requiredTotal?: number;
    releaseDecision?: string;
    allSoftwareObjective?: string;
    includedFiles?: Array<{ destination?: string }>;
    generatedFiles?: Array<{ destination?: string; role?: string }>;
  }>("artifacts/productization/public-beta-packet/public-beta-manifest.json");
  const betaPreparation = readJson<{
    responseMode?: string;
    status?: string;
    passed?: number;
    total?: number;
    releaseDecision?: string;
    accepted?: boolean;
    packagingGated?: boolean;
    steps?: Array<{ status?: string; outputTail?: string }>;
  }>("artifacts/productization/public-beta-preparation.json");
  const betaFollowUpPlan = readJson<{
    responseMode?: string;
    status?: string;
    canInviteNextTester?: boolean;
    releaseDecision?: string;
    accepted?: boolean;
    packagingGated?: boolean;
    actions?: unknown[];
  }>("artifacts/productization/public-beta-follow-up-plan.json");
  const betaFollowUpPlanVerification = readJson<{
    responseMode?: string;
    status?: string;
    passed?: number;
    total?: number;
    releaseDecision?: string;
    accepted?: boolean;
    packagingGated?: boolean;
  }>("artifacts/productization/public-beta-follow-up-plan-verification.json");
  const betaTesterInvite = readJson<{
    responseMode?: string;
    status?: string;
    canInvite?: boolean;
    failedReasons?: string[];
    releaseDecision?: string;
    accepted?: boolean;
    packagingGated?: boolean;
    testerChecklist?: unknown[];
    maintainerChecklist?: unknown[];
  }>("artifacts/productization/public-beta-tester-invite.json");
  const betaTesterInviteVerification = readJson<{
    responseMode?: string;
    status?: string;
    passed?: number;
    total?: number;
    releaseDecision?: string;
    accepted?: boolean;
    packagingGated?: boolean;
  }>("artifacts/productization/public-beta-tester-invite-verification.json");
  const betaTesterSessionPreflight = readJson<{
    responseMode?: string;
    status?: string;
    canInviteTester?: boolean;
    passed?: number;
    total?: number;
    releaseDecision?: string;
    accepted?: boolean;
    packagingGated?: boolean;
    generatedAt?: string;
  }>("artifacts/productization/public-beta-tester-session-preflight.json");
  const productizationEvidenceFreshness = readJson<{
    generatedAt?: string;
    status?: string;
    passed?: number;
    total?: number;
  }>("artifacts/productization/productization-evidence-freshness.json");
  const betaReturnIntakeVerification = readJson<{
    responseMode?: string;
    status?: string;
    passed?: number;
    total?: number;
    releaseDecision?: string;
    accepted?: boolean;
    packagingGated?: boolean;
  }>("artifacts/productization/public-beta-return-intake-verification.json");
  const preparationOutput = (betaPreparation?.steps ?? []).map((step) => step.outputTail ?? "").join("\n");
  const betaIncludesPreparation =
    betaManifest?.includedFiles?.some((file) => file.destination === "evidence/public-beta-preparation.json") === true;
  const betaIncludesFollowUpPlan =
    betaManifest?.includedFiles?.some((file) => file.destination === "evidence/public-beta-follow-up-plan.json") ===
    true;
  const betaIncludesFollowUpPlanVerification =
    betaManifest?.includedFiles?.some(
      (file) => file.destination === "evidence/public-beta-follow-up-plan-verification.json"
    ) === true;
  const betaIncludesTesterInvite =
    betaManifest?.includedFiles?.some((file) => file.destination === "evidence/public-beta-tester-invite.json") ===
    true;
  const betaIncludesTesterInviteVerification =
    betaManifest?.includedFiles?.some(
      (file) => file.destination === "evidence/public-beta-tester-invite-verification.json"
    ) === true;
  const betaIncludesTesterInviteMarkdown =
    betaManifest?.includedFiles?.some((file) => file.destination === "docs/PUBLIC_BETA_TESTER_INVITE.md") === true;
  const betaIncludesTesterRunbook =
    betaManifest?.generatedFiles?.some(
      (file) => file.destination === "docs/PUBLIC_BETA_TESTER_RUNBOOK.md" && file.role === "tester_runbook"
    ) === true && fileExistsWithSize("artifacts/productization/public-beta-packet/docs/PUBLIC_BETA_TESTER_RUNBOOK.md", 1000);
  const betaIncludesTesterSessionPreflight =
    betaManifest?.includedFiles?.some(
      (file) => file.destination === "evidence/public-beta-tester-session-preflight.json"
    ) === true;
  const betaIncludesReturnIntakeVerification =
    betaManifest?.includedFiles?.some(
      (file) => file.destination === "evidence/public-beta-return-intake-verification.json"
    ) === true;
  const testerSessionPreflightMs = timestampMs(betaTesterSessionPreflight?.generatedAt);
  const freshnessMs = timestampMs(productizationEvidenceFreshness?.generatedAt);
  const testerSessionPreflightFreshEnough =
    Number.isFinite(testerSessionPreflightMs) && Number.isFinite(freshnessMs) && testerSessionPreflightMs >= freshnessMs;
  const testerSessionPreflightValid =
    betaTesterSessionPreflight?.responseMode === "public_beta_tester_session_preflight_json_v1" &&
    betaTesterSessionPreflight.status === "passed" &&
    betaTesterSessionPreflight.canInviteTester === true &&
    betaTesterSessionPreflight.passed === betaTesterSessionPreflight.total &&
    Number(betaTesterSessionPreflight.total ?? 0) >= 10 &&
    betaTesterSessionPreflight.releaseDecision === "do_not_release" &&
    betaTesterSessionPreflight.accepted === false &&
    betaTesterSessionPreflight.packagingGated === true;
  const testerSessionPreflightPackagingMatchesFreshness = testerSessionPreflightFreshEnough
    ? betaIncludesTesterSessionPreflight
    : !betaIncludesTesterSessionPreflight;
  if (
    betaPreparation?.responseMode !== "public_beta_preparation_receipt_json_v1" ||
    betaPreparation.status !== "passed" ||
    betaPreparation.passed !== betaPreparation.total ||
    betaPreparation.releaseDecision !== "do_not_release" ||
    betaPreparation.accepted !== false ||
    betaPreparation.packagingGated !== true ||
    !betaIncludesPreparation ||
    preparationOutput.trim() ||
    /[A-Z]:\\/.test(preparationOutput)
  ) {
    throw new Error(
      [
        "Public beta preparation evidence is not ready for source packaging.",
        `status=${betaPreparation?.status ?? "missing"}`,
        `checks=${betaPreparation?.passed ?? "?"}/${betaPreparation?.total ?? "?"}`,
        `betaIncludesPreparation=${betaIncludesPreparation}`,
        `compactReceipt=${!preparationOutput.trim()}`,
        `pathSanitized=${!/[A-Z]:\\/.test(preparationOutput)}`
      ].join(" ")
    );
  }
  if (
    betaTesterInvite?.responseMode !== "public_beta_tester_invite_json_v1" ||
    betaTesterInvite.status !== "ready_to_invite" ||
    betaTesterInvite.canInvite !== true ||
    (betaTesterInvite.failedReasons?.length ?? -1) !== 0 ||
    betaTesterInvite.releaseDecision !== "do_not_release" ||
    betaTesterInvite.accepted !== false ||
    betaTesterInvite.packagingGated !== true ||
    Number(betaTesterInvite.testerChecklist?.length ?? 0) < 6 ||
    Number(betaTesterInvite.maintainerChecklist?.length ?? 0) < 5 ||
    betaTesterInviteVerification?.responseMode !== "public_beta_tester_invite_verification_json_v1" ||
    betaTesterInviteVerification.status !== "passed" ||
    betaTesterInviteVerification.passed !== betaTesterInviteVerification.total ||
    betaTesterInviteVerification.releaseDecision !== "do_not_release" ||
    betaTesterInviteVerification.accepted !== false ||
    betaTesterInviteVerification.packagingGated !== true ||
    (testerSessionPreflightFreshEnough && !testerSessionPreflightValid) ||
    !betaIncludesTesterInvite ||
    !betaIncludesTesterInviteVerification ||
    !betaIncludesTesterInviteMarkdown ||
    !betaIncludesTesterRunbook ||
    !testerSessionPreflightPackagingMatchesFreshness ||
    betaReturnIntakeVerification?.responseMode !== "public_beta_return_intake_verification_json_v1" ||
    betaReturnIntakeVerification.status !== "passed" ||
    betaReturnIntakeVerification.passed !== betaReturnIntakeVerification.total ||
    betaReturnIntakeVerification.releaseDecision !== "do_not_release" ||
    betaReturnIntakeVerification.accepted !== false ||
    betaReturnIntakeVerification.packagingGated !== true ||
    !betaIncludesReturnIntakeVerification
  ) {
    throw new Error(
      [
        "Public beta tester invite evidence is not ready for source packaging.",
        `inviteStatus=${betaTesterInvite?.status ?? "missing"}`,
        `canInvite=${betaTesterInvite?.canInvite ?? "missing"}`,
        `failed=${betaTesterInvite?.failedReasons?.join(",") || "none"}`,
        `verification=${betaTesterInviteVerification?.status ?? "missing"} ${
          betaTesterInviteVerification?.passed ?? "?"
        }/${betaTesterInviteVerification?.total ?? "?"}`,
        `betaIncludesTesterInvite=${betaIncludesTesterInvite}`,
        `betaIncludesTesterInviteVerification=${betaIncludesTesterInviteVerification}`,
        `betaIncludesTesterInviteMarkdown=${betaIncludesTesterInviteMarkdown}`,
        `betaIncludesTesterRunbook=${betaIncludesTesterRunbook}`,
        `testerSessionPreflight=${betaTesterSessionPreflight?.status ?? "missing"} ${
          betaTesterSessionPreflight?.passed ?? "?"
        }/${betaTesterSessionPreflight?.total ?? "?"}`,
        `testerSessionPreflightFreshEnough=${testerSessionPreflightFreshEnough}`,
        `testerSessionPreflightValid=${testerSessionPreflightValid}`,
        `betaIncludesTesterSessionPreflight=${betaIncludesTesterSessionPreflight}`,
        `returnIntakeVerification=${betaReturnIntakeVerification?.status ?? "missing"} ${
          betaReturnIntakeVerification?.passed ?? "?"
        }/${betaReturnIntakeVerification?.total ?? "?"}`,
        `betaIncludesReturnIntakeVerification=${betaIncludesReturnIntakeVerification}`
      ].join(" ")
    );
  }
  if (
    betaFollowUpPlan?.responseMode !== "public_beta_follow_up_plan_json_v1" ||
    !["waiting_for_feedback", "ready_for_next_beta_tester"].includes(betaFollowUpPlan.status ?? "") ||
    betaFollowUpPlan.releaseDecision !== "do_not_release" ||
    betaFollowUpPlan.accepted !== false ||
    betaFollowUpPlan.packagingGated !== true ||
    Number(betaFollowUpPlan.actions?.length ?? 0) < 2 ||
    betaFollowUpPlanVerification?.responseMode !== "public_beta_follow_up_plan_verification_json_v1" ||
    betaFollowUpPlanVerification.status !== "passed" ||
    betaFollowUpPlanVerification.passed !== betaFollowUpPlanVerification.total ||
    betaFollowUpPlanVerification.releaseDecision !== "do_not_release" ||
    betaFollowUpPlanVerification.accepted !== false ||
    betaFollowUpPlanVerification.packagingGated !== true ||
    !betaIncludesFollowUpPlan ||
    !betaIncludesFollowUpPlanVerification
  ) {
    throw new Error(
      [
        "Public beta follow-up plan evidence is not ready for source packaging.",
        `planStatus=${betaFollowUpPlan?.status ?? "missing"}`,
        `planActions=${betaFollowUpPlan?.actions?.length ?? "?"}`,
        `verification=${betaFollowUpPlanVerification?.status ?? "missing"} ${
          betaFollowUpPlanVerification?.passed ?? "?"
        }/${betaFollowUpPlanVerification?.total ?? "?"}`,
        `betaIncludesFollowUpPlan=${betaIncludesFollowUpPlan}`,
        `betaIncludesFollowUpPlanVerification=${betaIncludesFollowUpPlanVerification}`
      ].join(" ")
    );
  }

  const manifest = {
    responseMode: "github_source_package_manifest_json_v1",
    status: "built",
    generatedAt: new Date().toISOString(),
    source: "package:github-source",
    archivePath: path.relative(rootDir, archivePath).replaceAll("\\", "/"),
    stagingDir: path.relative(rootDir, stagingDir).replaceAll("\\", "/"),
    archiveBytes: fs.statSync(archivePath).size,
    archiveSha256: sha256File(archivePath),
    packageBoundary: {
      uploadReady: true,
      includesSecrets: false,
      includesDependencies: false,
      includesLocalDatabase: false,
      includesBuildCache: false
    },
    publicBeta: {
      status: betaManifest?.status ?? "missing",
      betaCanStart: betaManifest?.betaCanStart ?? false,
      requiredPassed: betaManifest?.requiredPassed ?? 0,
      requiredTotal: betaManifest?.requiredTotal ?? 0,
      releaseDecision: betaManifest?.releaseDecision ?? "missing",
      allSoftwareObjective: betaManifest?.allSoftwareObjective ?? "missing"
    },
    publicBetaPreparation: {
      status: betaPreparation?.status ?? "missing",
      passed: betaPreparation?.passed ?? 0,
      total: betaPreparation?.total ?? 0,
      releaseDecision: betaPreparation?.releaseDecision ?? "missing",
      accepted: betaPreparation?.accepted ?? null,
      packagingGated: betaPreparation?.packagingGated ?? null,
      betaPacketIncludesPreparation: betaIncludesPreparation,
      compactReceipt: !preparationOutput.trim(),
      pathSanitized: !/[A-Z]:\\/.test(preparationOutput)
    },
    publicBetaFollowUpPlan: {
      status: betaFollowUpPlan?.status ?? "missing",
      canInviteNextTester: betaFollowUpPlan?.canInviteNextTester ?? false,
      actionCount: betaFollowUpPlan?.actions?.length ?? 0,
      releaseDecision: betaFollowUpPlan?.releaseDecision ?? "missing",
      accepted: betaFollowUpPlan?.accepted ?? null,
      packagingGated: betaFollowUpPlan?.packagingGated ?? null,
      verificationStatus: betaFollowUpPlanVerification?.status ?? "missing",
      verificationPassed: betaFollowUpPlanVerification?.passed ?? 0,
      verificationTotal: betaFollowUpPlanVerification?.total ?? 0,
      betaPacketIncludesFollowUpPlan: betaIncludesFollowUpPlan,
      betaPacketIncludesFollowUpPlanVerification: betaIncludesFollowUpPlanVerification
    },
    newRepositoryBootstrap: {
      status: stagedBootstrap.receipt.status ?? "missing",
      passed: stagedBootstrap.receipt.passed ?? 0,
      total: stagedBootstrap.receipt.total ?? 0,
      releaseDecision: stagedBootstrap.receipt.releaseDecision ?? "missing",
      allSoftwareObjective: stagedBootstrap.receipt.allSoftwareObjective ?? "missing",
      accepted: stagedBootstrap.receipt.accepted ?? null,
      packagingGated: stagedBootstrap.receipt.packagingGated ?? null,
      canRelease: stagedBootstrap.receipt.canRelease ?? null,
      canActivateRealModel: stagedBootstrap.receipt.canActivateRealModel ?? null,
      evidencePath: stagedBootstrap.generatedEvidence.destination
    },
    publicBetaTesterInvite: {
      status: betaTesterInvite?.status ?? "missing",
      canInvite: betaTesterInvite?.canInvite ?? false,
      failedReasonCount: betaTesterInvite?.failedReasons?.length ?? 0,
      releaseDecision: betaTesterInvite?.releaseDecision ?? "missing",
      accepted: betaTesterInvite?.accepted ?? null,
      packagingGated: betaTesterInvite?.packagingGated ?? null,
      verificationStatus: betaTesterInviteVerification?.status ?? "missing",
      verificationPassed: betaTesterInviteVerification?.passed ?? 0,
      verificationTotal: betaTesterInviteVerification?.total ?? 0,
      betaPacketIncludesTesterInvite: betaIncludesTesterInvite,
      betaPacketIncludesTesterInviteVerification: betaIncludesTesterInviteVerification,
      betaPacketIncludesTesterInviteMarkdown: betaIncludesTesterInviteMarkdown,
      betaPacketIncludesTesterRunbook: betaIncludesTesterRunbook,
      testerSessionPreflightStatus: betaTesterSessionPreflight?.status ?? "missing",
      testerSessionPreflightCanInvite: betaTesterSessionPreflight?.canInviteTester ?? false,
      testerSessionPreflightPassed: betaTesterSessionPreflight?.passed ?? 0,
      testerSessionPreflightTotal: betaTesterSessionPreflight?.total ?? 0,
      testerSessionPreflightGeneratedAt: betaTesterSessionPreflight?.generatedAt ?? "missing",
      productizationEvidenceFreshnessGeneratedAt: productizationEvidenceFreshness?.generatedAt ?? "missing",
      testerSessionPreflightFreshEnough,
      betaPacketIncludesTesterSessionPreflight: betaIncludesTesterSessionPreflight,
      returnIntakeVerificationStatus: betaReturnIntakeVerification?.status ?? "missing",
      returnIntakeVerificationPassed: betaReturnIntakeVerification?.passed ?? 0,
      returnIntakeVerificationTotal: betaReturnIntakeVerification?.total ?? 0,
      betaPacketIncludesReturnIntakeVerification: betaIncludesReturnIntakeVerification
    },
    copiedTopLevel,
    copiedEvidence,
    generatedEvidence,
    excluded: {
      topLevel: Array.from(excludedTopLevel).sort(),
      fileNames: Array.from(excludedFileNames).sort(),
      filePatterns: excludedFilePatterns.map((pattern) => pattern.source)
    },
    uploadChecklist: [
      "Extract the zip or upload its contents to a new GitHub repository root.",
      "Run npm run verify:new-repo-bootstrap before npm install; it is dependency-free and checks the source-only handoff boundary, first-read docs, Productization CI workflow, and release locks.",
      "Confirm Node >=22 <25 and npm >=10; these must match package.json#engines and the Productization CI Node 22 workflow.",
      `Keep .env out of GitHub; create it from .env.example after checkout with node -e "require('node:fs').copyFileSync('.env.example','.env')" from any shell, or Copy-Item .env.example .env in PowerShell, or cp .env.example .env in bash.`,
      "Run npm install.",
      "Run npm run typecheck.",
      "Run npm run test.",
      "Run npm run verify:product -- --port 3110.",
      "Start the product runtime with npm run start:product -- --hostname 127.0.0.1 --port 3000 and confirm http://127.0.0.1:3000/api/health reports product_health_json_v1 healthy.",
      "Run npm run prepare:public-beta -- --base-url http://127.0.0.1:3000 before inviting testers.",
    "Run npm run smoke:manual-browser -- --base-url http://127.0.0.1:3000 when fresh desktop/mobile manual acceptance workbench screenshots are needed.",
    "Run npm run smoke:public-beta-browser -- --base-url http://127.0.0.1:3000 when /public-beta feedback workbench UI changes.",
    "Run npm run smoke:handoff-browser -- --base-url http://127.0.0.1:3000 when fresh desktop/mobile handoff return-loop screenshots are needed.",
      "Give artifacts/productization/public-beta-packet/docs/PUBLIC_BETA_SESSION_PLAN.md and artifacts/productization/public-beta-packet/docs/PUBLIC_BETA_SESSION_RECEIPT.template.json to the facilitator, and artifacts/productization/public-beta-packet/docs/PUBLIC_BETA_TESTER_RUNBOOK.md to the tester as the clean session materials.",
      "Run npm run preflight:public-beta-tester -- --base-url http://127.0.0.1:3000 immediately before contacting one tester.",
      "After the tester session, run npm run verify:public-beta-session-receipt -- --receipt <path> on the filled whole-session receipt; after the tester returns a filled public beta feedback receipt, run npm run verify:public-beta-feedback -- --receipt <path>, then npm run intake:public-beta-return -- --receipt <path> --session-receipt <session-receipt-path> --send-receipt-validation artifacts/productization/first-real-tester-send-receipt-validation.json before inviting another tester; require the same tester.name/tester.date and sessionEvidence.feedbackReceiptPath pointing at the submitted feedback receipt.",
    "Run npm run preflight:human-acceptance -- --base-url http://127.0.0.1:3000, then npm run build:human-acceptance-reviewer-kit and npm run verify:human-acceptance-reviewer-kit before asking a real reviewer to save human_review evidence.",
    "Run npm run build:human-acceptance-receipt-template and npm run verify:human-acceptance-receipt before relying on human reviewer evidence.",
    "Run npm run build:human-acceptance-reviewer-invite and npm run verify:human-acceptance-reviewer-invite immediately before contacting one real reviewer; use the invite copy only as review-start material, not acceptance.",
      "Run npm run intake:human-acceptance-return -- --receipt <path> --send-receipt-validation artifacts/productization/first-real-tester-send-receipt-validation.json when a real reviewer returns a filled human acceptance receipt.",
      "Run npm run verify:human-acceptance-return-intake after human return intake; only after it passes, run the intake receipt's postIntakeRefresh.commandSequence before relying on refreshed reviewer invite, blocker board, status summary, takeover matrix, or evidence freshness files.",
      "Run npm run verify:product-release-readiness -- --allow-blocked to refresh the current release gate before blocker board, status summary, or operator brief.",
      "Run npm run build:product-release-blocker-board and npm run verify:product-release-blocker-board before release follow-up planning.",
      "Run npm run build:product-operator-brief and npm run verify:product-operator-brief to refresh the concise next-step handoff.",
      "Run npm run build:product-status-summary and npm run verify:product-status-summary to refresh the companion product status page.",
      "Run npm run build:product-takeover-matrix and npm run verify:product-takeover-matrix to refresh the first-read takeover decision matrix.",
      "Run npm run build:productization-launch-checklist and npm run verify:productization-launch-checklist to refresh the controlled launch page before contacting testers or reviewers.",
      "Run npm run verify:productization-evidence-freshness to prove the productization evidence is from one coherent refresh sequence including the takeover matrix and controlled launch checklist.",
      "Run npm run harden:productization-locks, then npm run audit:productization-lock-coverage to add missing explicit top-level productization locks and verify there are no dangerous unlocks before packaging.",
      "Run npm run build:first-real-tester-launch, npm run verify:first-real-tester-launch, npm run build:first-real-tester-dispatch-packet, npm run verify:first-real-tester-dispatch-packet, npm run build:first-real-tester-send-bundle, npm run verify:first-real-tester-send-bundle, npm run build:first-real-tester-contact-readiness, npm run verify:first-real-tester-contact-readiness, npm run build:first-real-tester-send-execution-brief, npm run verify:first-real-tester-send-execution-brief, npm run build:first-real-tester-send-receipt-template, npm run verify:first-real-tester-send-receipt-template, npm run build:first-real-tester-final-go-no-go and npm run verify:first-real-tester-final-go-no-go before contacting the first real tester or reviewer; use first-real-tester-launch.md as the intent gate, first-real-tester-dispatch-packet/START_FIRST_REAL_TESTER.md as the lane decision packet, first-real-tester-send-bundle/SEND_TO_FIRST_EXTERNAL_PERSON as the only external send folder, require the send bundle SHA-256 fingerprints to verify, require first-real-tester-contact-readiness.md to say contactAllowed=true after the selected live preflight, open first-real-tester-send-execution-brief.md and require manualSendAllowed=true with actualSendPerformed=false before the manual send, use first-real-tester-send-receipt-template.md with expectedSha256 to record manual send state while release stays locked, and require first-real-tester-final-go-no-go.md to say manualSendAllowed=true immediately before the manual send; validate a filled copy with npm run verify:first-real-tester-send-receipt-template -- --receipt <path>; if validation fails, inspect failedChecks, follow remediationActions, and use nextAction before treating the send as recorded.",
      "Run npm run build:first-real-tester-return-workbench, npm run verify:first-real-tester-return-workbench, npm run build:first-real-tester-return-gate and npm run verify:first-real-tester-return-gate after any first tester or reviewer return and before inviting anyone else; confirm the return workbench Send Receipt Handoff requires first-real-tester-send-receipt-validation.json and pass it via --send-receipt-validation before lane intake when a manual send occurred, and use the return gate as the widening gate while release stays locked.",
      "Run npm run verify:product-takeover-entry, then npm run verify:project-takeover-assessment, to prove maintainer handoff docs and the plain-language takeover assessment match current productization evidence without hard-coded source archive SHAs.",
      "Run npm run verify:product-trial after rebuilding the product trial packet so its embedded verification receipt matches the current handoff bundle.",
      "Run npm run build:product-release-approval-template and npm run verify:product-release-approval before collecting separate release-review evidence.",
      "Run npm run intake:product-release-approval-return -- --receipt <path> when a separate release reviewer returns a filled receipt; require prerequisiteEvidence.aiServiceStatusPath to point to post-trial GET /api/ai-service-status JSON proving activeProvider=mock, realModelReady=false, manualProviderAcceptance=false, accepted=false, and packagingGated=true, then run npm run verify:product-release-approval-return-intake before relying on that release-review evidence.",
      "Run npm run verify:real-model-adapter-contract before any real provider trial planning.",
      "Run npm run build:real-model-trial-kit and npm run verify:real-model-trial-kit before any real provider trial.",
      "Open artifacts/productization/real-model-trial-kit.md#credential-redaction-checklist and confirm redacted_environment_summary, artifact_secret_scan_before_return, trial_log_minimization, and rollback_to_mock_after_trial before any real provider credential is used; stop if any returned artifact contains a secret or rollback to mock is not confirmed.",
      "Run npm run build:real-model-trial-receipt-template and npm run verify:real-model-trial-receipt before collecting real provider trial evidence.",
      "Run npm run intake:real-model-trial-return -- --receipt <path> when a real-model trial reviewer returns a filled receipt, then run npm run verify:real-model-trial-return-intake before relying on that trial evidence.",
      "Run npm run verify:public-beta.",
      "Run npm run build:product-delivery-index and npm run verify:product-delivery-index after the GitHub source package verifier passes to create the outer handoff pointer to the verified archive, including its package.json#scripts command contract and archive SHA-256.",
      "Run npm run ci:productization as the self-contained local productization gate before handing off a checkout; it starts or reuses the product server, confirms /api/health, runs the bounded productization gates against the selected base URL, refreshes the live human-acceptance and public-beta tester preflights, verifies the local CI receipt, stages the GitHub source package, verifies takeover-entry consistency against staged docs, rebuilds/verifies the final GitHub source package with that receipt, runs the dependency-free new-repository bootstrap check, then builds/verifies the product delivery index.",
      "Run npm run verify:productization-ci-local, npm run build:first-real-tester-send-bundle, npm run verify:first-real-tester-send-bundle, npm run build:first-real-tester-contact-readiness, npm run verify:first-real-tester-contact-readiness, npm run build:first-real-tester-send-execution-brief, npm run verify:first-real-tester-send-execution-brief, npm run build:first-real-tester-send-receipt-template, npm run verify:first-real-tester-send-receipt-template, npm run build:first-real-tester-final-go-no-go, npm run verify:first-real-tester-final-go-no-go, npm run package:github-source, npm run verify:product-takeover-entry, npm run verify:project-takeover-assessment, npm run package:github-source, npm run verify:github-source, npm run verify:new-repo-bootstrap -- --root artifacts/github-source-package/transparent-ai-apprentice-mcp, npm run build:product-delivery-index, and npm run verify:product-delivery-index only when refreshing those handoff artifacts separately from local ci:productization; confirm the archive SHA-256 remains in the source verification and delivery index.",
      "Confirm the Productization CI workflow passes in GitHub Actions, including the /api/health product runtime check and ci:productization:gates, before inviting a tester from that checkout."
    ]
  };

  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}
`, "utf8");
  console.log(JSON.stringify(manifest, null, 2));
}

main();
