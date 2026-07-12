import fs from "node:fs";
import path from "node:path";

type Check = { name: string; pass: boolean; evidence: string };

const rootDir = process.cwd();
const artifactsDir = path.join(rootDir, "artifacts", "productization");
const launchJsonPath = path.join(artifactsDir, "first-real-tester-launch.json");
const launchMarkdownPath = path.join(artifactsDir, "first-real-tester-launch.md");
const verificationPath = path.join(artifactsDir, "first-real-tester-launch-verification.json");

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

function fileExists(relativePath: string, minimumBytes = 1) {
  const fullPath = path.join(rootDir, relativePath);
  return fs.existsSync(fullPath) && fs.statSync(fullPath).size >= minimumBytes;
}

function push(checks: Check[], name: string, pass: boolean, evidence: string) {
  checks.push({ name, pass, evidence });
}

function main() {
  const launch = readJson<{
    responseMode?: string;
    status?: string;
    readyToLaunch?: boolean;
    failedReasons?: string[];
    productScope?: string;
    allSoftwareObjective?: string;
    releaseDecision?: string;
    reviewOnly?: boolean;
    accepted?: boolean;
    packagingGated?: boolean;
    canRelease?: boolean;
    canActivateRealModel?: boolean;
    sourcePackageReference?: {
      verificationReceiptPath?: string;
      deliveryIndexPath?: string;
      verification?: string;
      uploadReady?: boolean;
      bootstrapAllowed?: boolean;
      note?: string;
    };
    sourceEvidence?: Record<string, string>;
    launchLanes?: Array<{
      id?: string;
      allowed?: boolean;
      preflightCommand?: string;
      preflightEvidencePath?: string;
      sendMaterials?: string[];
      returnCommands?: string[];
      stopConditions?: string[];
    }>;
    maintainerChecklist?: string[];
    blockedActions?: string[];
    nextAction?: string;
  }>(launchJsonPath);
  const markdown = readText(launchMarkdownPath);
  const lanes = launch?.launchLanes ?? [];
  const betaLane = lanes.find((lane) => lane.id === "public_beta_tester_session");
  const humanLane = lanes.find((lane) => lane.id === "human_acceptance_review");
  const checks: Check[] = [];

  push(
    checks,
    "Launch packet is ready for exactly one bounded outside pass",
    launch?.responseMode === "first_real_tester_launch_json_v1" &&
      launch.status === "ready_to_invite_one_bounded_real_tester_or_reviewer" &&
      launch.readyToLaunch === true &&
      (launch.failedReasons?.length ?? -1) === 0 &&
      lanes.length === 2,
    `status=${launch?.status ?? "missing"}; ready=${launch?.readyToLaunch ?? "missing"}; lanes=${lanes.map((lane) => lane.id).join(",")}; failed=${launch?.failedReasons?.join(",") || "none"}`
  );

  push(
    checks,
    "Launch packet preserves productization locks",
    launch?.productScope === "bounded_core_teaching_loop" &&
      launch.allSoftwareObjective === "paused" &&
      launch.releaseDecision === "do_not_release" &&
      launch.reviewOnly === true &&
      launch.accepted === false &&
      launch.packagingGated === true &&
      launch.canRelease === false &&
      launch.canActivateRealModel === false &&
      markdown.includes("Can release: `false`") &&
      markdown.includes("Can activate real model: `false`"),
    `scope=${launch?.productScope ?? "missing"}; release=${launch?.releaseDecision ?? "missing"}; allSoftware=${launch?.allSoftwareObjective ?? "missing"}; accepted=${launch?.accepted ?? "missing"}; packagingGated=${launch?.packagingGated ?? "missing"}; canRelease=${launch?.canRelease ?? "missing"}; canActivateRealModel=${launch?.canActivateRealModel ?? "missing"}`
  );

  push(
    checks,
    "Launch packet references source package verification or CI bootstrap without pinning a stale archive SHA",
    launch?.sourcePackageReference?.uploadReady === true &&
      launch.sourcePackageReference.verificationReceiptPath === "artifacts/github-source-package/github-source-package-verification.json" &&
      launch.sourcePackageReference.deliveryIndexPath === "artifacts/productization/product-delivery-index.json" &&
      (/^passed ([1-9][0-9]*)\/\1$/.test(launch.sourcePackageReference.verification ?? "") ||
        launch.sourcePackageReference.verification?.includes("bootstrapAllowed=true") === true) &&
      launch.sourcePackageReference.note?.includes("must not pin a zip SHA") === true,
    `verification=${launch?.sourcePackageReference?.verification ?? "missing"}; receipt=${
      launch?.sourcePackageReference?.verificationReceiptPath ?? "missing"
    }; delivery=${launch?.sourcePackageReference?.deliveryIndexPath ?? "missing"}`
  );

  push(
    checks,
    "Public beta tester lane has send materials, preflight, return intake, and stop conditions",
    betaLane?.allowed === true &&
      betaLane.preflightCommand === "npm run preflight:public-beta-tester -- --base-url http://127.0.0.1:3000" &&
      betaLane.preflightEvidencePath === "artifacts/productization/public-beta-tester-session-preflight.json" &&
      betaLane.sendMaterials?.includes("artifacts/productization/public-beta-packet/docs/PUBLIC_BETA_TESTER_RUNBOOK.md") === true &&
      betaLane.sendMaterials.includes("artifacts/productization/public-beta-tester-invite.md") &&
      betaLane.sendMaterials.includes("artifacts/productization/public-beta-packet/docs/PUBLIC_BETA_SESSION_PLAN.md") &&
      betaLane.sendMaterials.includes("artifacts/productization/public-beta-packet/docs/PUBLIC_BETA_SESSION_RECEIPT.template.json") &&
      betaLane.returnCommands?.includes("npm run verify:public-beta-session-receipt -- --receipt <path>") === true &&
      betaLane.returnCommands.includes("npm run verify:public-beta-feedback -- --receipt <path>") &&
      betaLane.returnCommands.includes(
        "npm run intake:public-beta-return -- --receipt <feedback-path> --session-receipt <session-receipt-path> --send-receipt-validation artifacts/productization/first-real-tester-send-receipt-validation.json"
      ) &&
      betaLane.returnCommands.includes("npm run build:first-real-tester-return-workbench") &&
      betaLane.returnCommands.includes("npm run verify:first-real-tester-return-workbench") &&
      betaLane.returnCommands.includes("npm run build:first-real-tester-return-gate") &&
      betaLane.returnCommands.includes("npm run verify:first-real-tester-return-gate") &&
      betaLane.stopConditions?.some((condition) => condition.includes("tester.name/tester.date")) === true &&
      betaLane.stopConditions.some((condition) => condition.includes("sessionEvidence.feedbackReceiptPath")) &&
      betaLane.stopConditions.some((condition) => condition.includes("release")) &&
      betaLane.sendMaterials.every((item) => fileExists(item, 500)),
    `preflight=${betaLane?.preflightCommand ?? "missing"}; materials=${betaLane?.sendMaterials?.length ?? 0}; returns=${betaLane?.returnCommands?.length ?? 0}`
  );

  push(
    checks,
    "Human acceptance lane has reviewer materials, preflight, return intake, and human_review stop conditions",
    humanLane?.allowed === true &&
      humanLane.preflightCommand === "npm run preflight:human-acceptance -- --base-url http://127.0.0.1:3000" &&
      humanLane.preflightEvidencePath === "artifacts/productization/human-acceptance-session-preflight.json" &&
      humanLane.sendMaterials?.includes("artifacts/productization/human-acceptance-reviewer-invite.md") === true &&
      humanLane.sendMaterials.includes("artifacts/productization/human-acceptance-reviewer-kit.md") &&
      humanLane.sendMaterials.includes("artifacts/productization/human-acceptance-receipt.template.json") &&
      humanLane.returnCommands?.includes("npm run verify:human-acceptance-receipt -- --receipt <path>") === true &&
      humanLane.returnCommands.includes("npm run intake:human-acceptance-return -- --receipt <path> --send-receipt-validation artifacts/productization/first-real-tester-send-receipt-validation.json") &&
      humanLane.returnCommands.includes("npm run verify:human-acceptance-return-intake") &&
      humanLane.returnCommands.includes("npm run build:first-real-tester-return-workbench") &&
      humanLane.returnCommands.includes("npm run verify:first-real-tester-return-workbench") &&
      humanLane.returnCommands.includes("npm run build:first-real-tester-return-gate") &&
      humanLane.returnCommands.includes("npm run verify:first-real-tester-return-gate") &&
      humanLane.returnCommands.includes("npm run verify:human-acceptance") &&
      humanLane.stopConditions?.some((condition) => condition.includes("evidenceKind=human_review")) === true &&
      humanLane.stopConditions.some((condition) => condition.includes("humanReviewed=true")) &&
      humanLane.stopConditions.some((condition) => condition.includes("release")) &&
      humanLane.sendMaterials.every((item) => fileExists(item, 500)),
    `preflight=${humanLane?.preflightCommand ?? "missing"}; materials=${humanLane?.sendMaterials?.length ?? 0}; returns=${humanLane?.returnCommands?.length ?? 0}`
  );

  push(
    checks,
    "Launch packet is backed by current green entrypoint evidence",
    launch?.sourceEvidence?.deliveryIndex === "ready_for_handoff" &&
      /^passed ([1-9][0-9]*)\/\1$/.test(launch.sourceEvidence.deliveryIndexVerification ?? "") &&
      (/^passed ([1-9][0-9]*)\/\1$/.test(launch.sourceEvidence.sourcePackageVerification ?? "") ||
        launch.sourceEvidence.sourcePackageVerification?.includes("bootstrapAllowed=true") === true) &&
      launch.sourceEvidence.publicBetaPreflight?.includes("passed 12/12") === true &&
      launch.sourceEvidence.publicBetaPreflight.includes("canInvite=true") &&
      launch.sourceEvidence.publicBetaInvite?.includes("ready_to_invite") === true &&
      launch.sourceEvidence.publicBetaInvite.includes("verifier=passed 8/8") &&
      launch.sourceEvidence.publicBetaSessionPlan?.includes("ready_for_session") === true &&
      launch.sourceEvidence.publicBetaSessionPlan.includes("verifier=passed 10/10") &&
      launch.sourceEvidence.publicBetaSessionReceipt === "template_ready 9/9" &&
      launch.sourceEvidence.humanAcceptancePreflight?.includes("passed 8/8") === true &&
      launch.sourceEvidence.humanAcceptancePreflight.includes("canStart=true") &&
      launch.sourceEvidence.humanReviewerInvite?.includes("ready_to_invite_reviewer") === true &&
      launch.sourceEvidence.humanReviewerInvite.includes("verifier=passed 7/7") &&
      launch.sourceEvidence.humanReviewerKit?.includes("ready_for_reviewer") === true &&
      launch.sourceEvidence.humanReviewerKit.includes("verifier=passed 8/8") &&
      launch.sourceEvidence.humanAcceptanceReceipt === "template_ready 7/7" &&
      launch.sourceEvidence.lockAudit === "passed; missing=0; dangerous=0",
    `evidence=${JSON.stringify(launch?.sourceEvidence ?? {})}`
  );

  push(
    checks,
    "Launch packet limits maintainer action before wider rollout",
    Number(launch?.maintainerChecklist?.length ?? 0) >= 5 &&
      launch?.maintainerChecklist?.some((item) => item.includes("Choose exactly one lane")) === true &&
      launch.maintainerChecklist.some((item) => item.includes("before inviting any additional tester")) &&
      launch.maintainerChecklist.some((item) => item.includes("first-real-tester-return-workbench")) &&
      launch.maintainerChecklist.some((item) => item.includes("first-real-tester-return-gate")) &&
      launch.maintainerChecklist.some((item) => item.includes("releaseDecision=do_not_release")) &&
      launch.blockedActions?.includes("invite_multiple_testers_before_processing_first_return") === true &&
      launch.blockedActions.includes("release_product") &&
      launch.nextAction?.includes("Invite one bounded real tester or human reviewer") === true,
    `checklist=${launch?.maintainerChecklist?.length ?? 0}; blocked=${launch?.blockedActions?.join(",") ?? "missing"}; next=${launch?.nextAction ?? "missing"}`
  );

  push(
    checks,
    "Launch Markdown is readable and names both lanes",
    markdown.includes("# First Real Tester Launch") &&
      markdown.includes("Source Package Reference") &&
      markdown.includes("product-delivery-index.json") &&
      markdown.includes("One bounded public beta tester session") &&
      markdown.includes("One real human acceptance review") &&
      markdown.includes("PUBLIC_BETA_SESSION_RECEIPT.template.json") &&
      markdown.includes("human-acceptance-receipt.template.json") &&
      markdown.includes("not release approval") &&
      markdown.length > 2500,
    `markdownBytes=${markdown.length}`
  );

  const passed = checks.filter((check) => check.pass).length;
  const verification = {
    responseMode: "first_real_tester_launch_verification_json_v1",
    status: passed === checks.length ? "passed" : "failed",
    generatedAt: new Date().toISOString(),
    command: "npm run verify:first-real-tester-launch",
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
        ? "Use first-real-tester-launch.md as the single-send starting point for one bounded real tester or reviewer."
        : "Rebuild first-real-tester-launch and fix failed launch checks before contacting a real tester or reviewer."
  };

  fs.writeFileSync(verificationPath, `${JSON.stringify(verification, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(verification, null, 2));
  console.log(`\nFirst real tester launch verification written to ${verificationPath}`);

  if (verification.status !== "passed") process.exitCode = 1;
}

try {
  main();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}

export {};
