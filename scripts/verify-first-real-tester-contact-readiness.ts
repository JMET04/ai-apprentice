import fs from "node:fs";
import path from "node:path";

type Check = { name: string; pass: boolean; evidence: string };

type Readiness = {
  responseMode?: string;
  status?: string;
  generatedAt?: string;
  productScope?: string;
  allSoftwareObjective?: string;
  releaseDecision?: string;
  reviewOnly?: boolean;
  accepted?: boolean;
  packagingGated?: boolean;
  canRelease?: boolean;
  canActivateRealModel?: boolean;
  selectedLane?: { id?: string; preflightCommand?: string; preflightEvidencePath?: string };
  contactAllowed?: boolean;
  actualSendPerformed?: boolean;
  contactDecision?: string;
  sendBoundary?: {
    externalSendFolder?: string;
    returnIntakeFolder?: string;
    sendReceiptTemplatePath?: string;
    validationCommandAfterManualSend?: string;
    validationEvidencePath?: string;
  };
  checks?: Array<{ name?: string; pass?: boolean; evidence?: string; requiredForContact?: boolean; nextAction?: string }>;
  failedRequiredChecks?: string[];
  blockedActions?: string[];
  nextAction?: string;
};

type SendBundle = {
  responseMode?: string;
  status?: string;
  generatedAt?: string;
  selectedLane?: { id?: string; preflightCommand?: string; preflightEvidencePath?: string };
  externalSendFolder?: string;
  returnIntakeFolder?: string;
  actualSendPerformed?: boolean;
};

type PreflightReceipt = {
  responseMode?: string;
  status?: string;
  generatedAt?: string;
  canInviteTester?: boolean;
  releaseDecision?: string;
  accepted?: boolean;
  packagingGated?: boolean;
  passed?: number;
  total?: number;
};

const rootDir = process.cwd();
const artifactsDir = path.join(rootDir, "artifacts", "productization");
const readinessPath = path.join(artifactsDir, "first-real-tester-contact-readiness.json");
const readinessMarkdownPath = path.join(artifactsDir, "first-real-tester-contact-readiness.md");
const verificationPath = path.join(artifactsDir, "first-real-tester-contact-readiness-verification.json");

function readJson<T>(targetPath: string): T | null {
  try {
    return JSON.parse(fs.readFileSync(targetPath, "utf8")) as T;
  } catch {
    return null;
  }
}

function readText(targetPath: string) {
  try {
    return fs.readFileSync(targetPath, "utf8");
  } catch {
    return "";
  }
}

function timestampMs(value: string | undefined) {
  const parsed = Date.parse(value ?? "");
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function isCurrentOrNewer(candidate: string | undefined, source: string | undefined) {
  const candidateMs = timestampMs(candidate);
  const sourceMs = timestampMs(source);
  return Number.isFinite(candidateMs) && Number.isFinite(sourceMs) && candidateMs >= sourceMs;
}

function push(checks: Check[], name: string, pass: boolean, evidence: string) {
  checks.push({ name, pass, evidence });
}

function fileExists(relativePath: string, minBytes = 1) {
  const full = path.join(rootDir, relativePath);
  return fs.existsSync(full) && fs.statSync(full).size >= minBytes;
}

function main() {
  const readiness = readJson<Readiness>(readinessPath);
  const bundle = readJson<SendBundle>(path.join(artifactsDir, "first-real-tester-send-bundle.json"));
  const preflightPath = bundle?.selectedLane?.preflightEvidencePath
    ? path.join(rootDir, bundle.selectedLane.preflightEvidencePath)
    : path.join(artifactsDir, "public-beta-tester-session-preflight.json");
  const preflight = readJson<PreflightReceipt>(preflightPath);
  const markdown = readText(readinessMarkdownPath);
  const checks: Check[] = [];
  const requiredChecks = readiness?.checks?.filter((check) => check.requiredForContact === true) ?? [];
  const failedRequired = requiredChecks.filter((check) => check.pass !== true).map((check) => check.name ?? "missing");
  const preflightFresh = isCurrentOrNewer(preflight?.generatedAt, bundle?.generatedAt);
  const expectedStatus =
    failedRequired.length === 0
      ? "ready_to_contact_first_external_person"
      : !preflightFresh
        ? "blocked_needs_live_preflight_refresh"
        : "blocked_before_contact";

  push(
    checks,
    "Contact readiness artifact exists and tells the truth about current status",
    readiness?.responseMode === "first_real_tester_contact_readiness_json_v1" &&
      readiness.status === expectedStatus &&
      readiness.contactAllowed === (expectedStatus === "ready_to_contact_first_external_person") &&
      readiness.contactDecision ===
        (expectedStatus === "ready_to_contact_first_external_person" ? "may_contact_exactly_one_person" : "do_not_contact") &&
      JSON.stringify(readiness.failedRequiredChecks ?? []) === JSON.stringify(failedRequired),
    `status=${readiness?.status ?? "missing"}; expected=${expectedStatus}; contactAllowed=${readiness?.contactAllowed ?? "missing"}; failed=${(readiness?.failedRequiredChecks ?? []).join(",") || "none"}`
  );

  push(
    checks,
    "Contact readiness preserves productization locks",
    readiness?.productScope === "bounded_core_teaching_loop" &&
      readiness.allSoftwareObjective === "paused" &&
      readiness.releaseDecision === "do_not_release" &&
      readiness.reviewOnly === true &&
      readiness.accepted === false &&
      readiness.packagingGated === true &&
      readiness.canRelease === false &&
      readiness.canActivateRealModel === false &&
      readiness.actualSendPerformed === false,
    `release=${readiness?.releaseDecision ?? "missing"}; accepted=${readiness?.accepted ?? "missing"}; packaging=${readiness?.packagingGated ?? "missing"}; canRelease=${readiness?.canRelease ?? "missing"}; canActivate=${readiness?.canActivateRealModel ?? "missing"}; allSoftware=${readiness?.allSoftwareObjective ?? "missing"}`
  );

  push(
    checks,
    "Contact readiness is bound to the selected send bundle and preflight evidence",
    bundle?.responseMode === "first_real_tester_send_bundle_json_v1" &&
      bundle.status === "ready_to_send_chosen_lane" &&
      bundle.actualSendPerformed === false &&
      readiness?.selectedLane?.id === bundle.selectedLane?.id &&
      readiness?.selectedLane?.preflightCommand === bundle.selectedLane?.preflightCommand &&
      readiness?.selectedLane?.preflightEvidencePath === bundle.selectedLane?.preflightEvidencePath &&
      readiness?.sendBoundary?.externalSendFolder === bundle.externalSendFolder &&
      readiness?.sendBoundary?.returnIntakeFolder === bundle.returnIntakeFolder,
    `lane=${readiness?.selectedLane?.id ?? "missing"}; bundleLane=${bundle?.selectedLane?.id ?? "missing"}; send=${readiness?.sendBoundary?.externalSendFolder ?? "missing"}`
  );

  push(
    checks,
    "Contact readiness models immediate live preflight freshness",
    preflight?.responseMode === "public_beta_tester_session_preflight_json_v1" &&
      preflight.status === "passed" &&
      preflight.canInviteTester === true &&
      preflight.releaseDecision === "do_not_release" &&
      preflight.accepted === false &&
      preflight.packagingGated === true &&
      preflight.passed === preflight.total &&
      requiredChecks.some((check) => check.name === "Live preflight is newer than the current send bundle") &&
      (preflightFresh || readiness?.status === "blocked_needs_live_preflight_refresh"),
    `preflight=${preflight?.generatedAt ?? "missing"}; bundle=${bundle?.generatedAt ?? "missing"}; fresh=${preflightFresh}; readiness=${readiness?.status ?? "missing"}`
  );

  push(
    checks,
    "Contact readiness exposes the post-send receipt validation handoff",
    readiness?.sendBoundary?.sendReceiptTemplatePath === "artifacts/productization/first-real-tester-send-receipt-template.md" &&
      readiness.sendBoundary.validationCommandAfterManualSend ===
        "npm run verify:first-real-tester-send-receipt-template -- --receipt <path>" &&
      readiness.sendBoundary.validationEvidencePath === "artifacts/productization/first-real-tester-send-receipt-validation.json" &&
      readiness.blockedActions?.includes("claim_acceptance_or_release_from_contact_readiness") === true,
    `template=${readiness?.sendBoundary?.sendReceiptTemplatePath ?? "missing"}; validation=${readiness?.sendBoundary?.validationEvidencePath ?? "missing"}; next=${readiness?.nextAction ?? "missing"}`
  );

  push(
    checks,
    "Contact readiness blocks unsafe contact transitions",
    readiness?.blockedActions?.includes("contact_more_than_one_external_person") === true &&
      readiness.blockedActions.includes("contact_without_current_live_preflight") &&
      readiness.blockedActions.includes("send_return_intake_folder") &&
      readiness.blockedActions.includes("send_release_approval_materials_as_first_test") &&
      readiness.blockedActions.includes("send_real_model_activation_materials_as_first_test") &&
      readiness.blockedActions.includes("claim_acceptance_or_release_from_contact_readiness"),
    `blocked=${readiness?.blockedActions?.join(",") ?? "missing"}`
  );

  push(
    checks,
    "Contact readiness Markdown is readable and explicit",
    fileExists("artifacts/productization/first-real-tester-contact-readiness.md", 1000) &&
      markdown.includes("# First Real Tester Contact Readiness") &&
      markdown.includes(`Status: \`${readiness?.status ?? "missing"}\``) &&
      markdown.includes("Contact allowed:") &&
      markdown.includes("first-real-tester-send-receipt-validation.json") &&
      markdown.includes("Can release: `false`") &&
      markdown.includes("Can activate real model: `false`"),
    `bytes=${markdown.length}`
  );

  const passed = checks.filter((check) => check.pass).length;
  const verification = {
    responseMode: "first_real_tester_contact_readiness_verification_json_v1",
    status: passed === checks.length ? "passed" : "failed",
    generatedAt: new Date().toISOString(),
    command: "npm run verify:first-real-tester-contact-readiness",
    productScope: "bounded_core_teaching_loop",
    allSoftwareObjective: "paused",
    releaseDecision: "do_not_release",
    reviewOnly: true,
    accepted: false,
    packagingGated: true,
    canRelease: false,
    canActivateRealModel: false,
    contactReadinessStatus: readiness?.status ?? "missing",
    contactAllowed: readiness?.contactAllowed ?? false,
    passed,
    total: checks.length,
    checks,
    nextAction:
      passed === checks.length && readiness?.contactAllowed === true
        ? "Contact exactly one external person with only SEND_TO_FIRST_EXTERNAL_PERSON, then validate the filled manual-send receipt."
        : "Refresh the selected lane live preflight and rebuild contact readiness before contacting anyone."
  };

  fs.writeFileSync(verificationPath, `${JSON.stringify(verification, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(verification, null, 2));
  console.log(`\nFirst real tester contact readiness verification written to ${verificationPath}`);
  if (verification.status !== "passed") process.exitCode = 1;
}

try {
  main();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}

export {};
