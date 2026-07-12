import fs from "node:fs";
import path from "node:path";

type Check = { name: string; pass: boolean; evidence: string };

const artifactsDir = path.join(process.cwd(), "artifacts", "productization");
const gateJsonPath = path.join(artifactsDir, "first-real-tester-return-gate.json");
const gateMarkdownPath = path.join(artifactsDir, "first-real-tester-return-gate.md");
const verificationPath = path.join(artifactsDir, "first-real-tester-return-gate-verification.json");

function readJson<T>(targetPath: string): T | null {
  try {
    return JSON.parse(fs.readFileSync(targetPath, "utf8")) as T;
  } catch {
    return null;
  }
}

function readText(targetPath: string): string {
  try {
    return fs.readFileSync(targetPath, "utf8");
  } catch {
    return "";
  }
}

function exists(relativePath: string): boolean {
  return fs.existsSync(path.join(process.cwd(), relativePath));
}

function push(checks: Check[], name: string, pass: boolean, evidence: string) {
  checks.push({ name, pass, evidence });
}

function main() {
  const gate = readJson<{
    responseMode?: string;
    status?: string;
    releaseDecision?: string;
    allSoftwareObjective?: string;
    reviewOnly?: boolean;
    accepted?: boolean;
    packagingGated?: boolean;
    canRelease?: boolean;
    canActivateRealModel?: boolean;
    launchReadiness?: { status?: string; readyToLaunch?: boolean; verification?: string };
    returnState?: { anyFirstReturnProcessed?: boolean; canInviteAdditionalTesterOrReviewer?: boolean; requiredBeforeAnyAdditionalInvite?: string[] };
    returnWorkbench?: {
      status?: string;
      verification?: string;
      finalGateCommand?: string;
      verifyManualSendReceiptBeforeReturnIntake?: boolean;
      sendReceiptHandoff?: {
        requiredBeforeReturnIntake?: boolean;
        sendBundleFingerprintGate?: string;
        submittedSendReceiptValidation?: string;
        validationCommand?: string;
        validationEvidencePath?: string;
      };
      evidencePath?: string;
    };
    laneStates?: Array<{
      id?: string;
      returnIntakeExists?: boolean;
      returnStatus?: string;
      verification?: string;
      nextRequiredCommand?: string;
      stopCondition?: string;
      canInviteNextTester?: boolean;
    }>;
    blockedActions?: string[];
    nextAction?: string;
  }>(gateJsonPath);
  const markdown = readText(gateMarkdownPath);
  const checks: Check[] = [];
  const publicBetaLane = gate?.laneStates?.find((lane) => lane.id === "public_beta_tester_session");
  const humanLane = gate?.laneStates?.find((lane) => lane.id === "human_acceptance_review");
  const publicBetaReturnExists = exists("artifacts/productization/public-beta-return-intake.json");
  const humanReturnExists = exists("artifacts/productization/human-acceptance-return-intake.json");

  push(
    checks,
    "Return gate exists and is current for the first real outside pass",
    gate?.responseMode === "first_real_tester_return_gate_json_v1" &&
      typeof gate.status === "string" &&
      fs.existsSync(gateJsonPath) &&
      fs.existsSync(gateMarkdownPath) &&
      fs.statSync(gateMarkdownPath).size >= 1000,
    `status=${gate?.status ?? "missing"}; markdown=${fs.existsSync(gateMarkdownPath) ? fs.statSync(gateMarkdownPath).size : 0}`
  );

  push(
    checks,
    "Return gate preserves productization locks",
    gate?.releaseDecision === "do_not_release" &&
      gate.allSoftwareObjective === "paused" &&
      gate.reviewOnly === true &&
      gate.accepted === false &&
      gate.packagingGated === true &&
      gate.canRelease === false &&
      gate.canActivateRealModel === false,
    `release=${gate?.releaseDecision ?? "missing"}; accepted=${gate?.accepted ?? "missing"}; packaging=${gate?.packagingGated ?? "missing"}; model=${gate?.canActivateRealModel ?? "missing"}`
  );

  push(
    checks,
    "Return gate starts from verified first-real launch evidence",
    gate?.launchReadiness?.status === "ready_to_invite_one_bounded_real_tester_or_reviewer" &&
      gate.launchReadiness.readyToLaunch === true &&
      gate.launchReadiness.verification === "passed 8/8",
    `launch=${gate?.launchReadiness?.status ?? "missing"}; ready=${gate?.launchReadiness?.readyToLaunch ?? "missing"}; verification=${gate?.launchReadiness?.verification ?? "missing"}`
  );

  push(
    checks,
    "Missing real return keeps additional invitations blocked",
    publicBetaReturnExists || humanReturnExists
      ? gate?.returnState?.canInviteAdditionalTesterOrReviewer === true || gate?.status === "first_return_processed_needs_follow_up_review"
      : gate?.status === "waiting_for_first_return" &&
          gate.returnState?.anyFirstReturnProcessed === false &&
          gate.returnState.canInviteAdditionalTesterOrReviewer === false &&
          gate.nextAction?.includes("before inviting anyone else") === true,
    `publicBetaReturn=${publicBetaReturnExists}; humanReturn=${humanReturnExists}; status=${gate?.status ?? "missing"}; canInvite=${gate?.returnState?.canInviteAdditionalTesterOrReviewer ?? "missing"}`
  );


  push(
    checks,
    "Return gate is backed by the first-return workbench",
    gate?.returnWorkbench?.status === "ready_to_process_exactly_one_first_return" &&
      /^passed ([1-9][0-9]*)\/\1$/.test(gate.returnWorkbench.verification ?? "") &&
      gate.returnWorkbench.finalGateCommand ===
        "npm run build:first-real-tester-return-gate && npm run verify:first-real-tester-return-gate" &&
      gate.returnWorkbench.evidencePath === "artifacts/productization/first-real-tester-return-workbench.md" &&
      gate.returnWorkbench.verifyManualSendReceiptBeforeReturnIntake === true &&
      gate.returnWorkbench.sendReceiptHandoff?.requiredBeforeReturnIntake === true &&
      gate.returnWorkbench.sendReceiptHandoff.sendBundleFingerprintGate === "sha256-bound" &&
      gate.returnWorkbench.sendReceiptHandoff.submittedSendReceiptValidation?.includes("not_submitted_yet") === true &&
      gate.returnWorkbench.sendReceiptHandoff.validationCommand ===
        "npm run verify:first-real-tester-send-receipt-template -- --receipt <filled-send-receipt-path>" &&
      gate.returnWorkbench.sendReceiptHandoff.validationEvidencePath ===
        "artifacts/productization/first-real-tester-send-receipt-validation.json" &&
      gate.returnState?.requiredBeforeAnyAdditionalInvite?.some((item) =>
        item.includes("first-real-tester-return-workbench.md")
      ) === true &&
      gate.returnState.requiredBeforeAnyAdditionalInvite.some((item) =>
        item.includes("first-real-tester send receipt")
      ) === true,
    `workbench=${gate?.returnWorkbench?.status ?? "missing"}; verification=${
      gate?.returnWorkbench?.verification ?? "missing"
    }; fingerprint=${gate?.returnWorkbench?.sendReceiptHandoff?.sendBundleFingerprintGate ?? "missing"}; evidence=${
      gate?.returnWorkbench?.evidencePath ?? "missing"
    }`
  );

  push(
    checks,
    "Return gate exposes both lane-specific intake commands",
    publicBetaLane?.nextRequiredCommand === "npm run intake:public-beta-return -- --receipt <feedback-path> --session-receipt <session-receipt-path> --send-receipt-validation artifacts/productization/first-real-tester-send-receipt-validation.json" &&
      humanLane?.nextRequiredCommand === "npm run intake:human-acceptance-return -- --receipt <path> --send-receipt-validation artifacts/productization/first-real-tester-send-receipt-validation.json" &&
      publicBetaLane.returnStatus === (publicBetaReturnExists ? publicBetaLane.returnStatus : "not_returned") &&
      humanLane.returnStatus === (humanReturnExists ? humanLane.returnStatus : "not_returned") &&
      /^passed ([1-9][0-9]*)\/\1$/.test(publicBetaLane.verification ?? "") &&
      /^passed ([1-9][0-9]*)\/\1$/.test(humanLane.verification ?? ""),
    `publicBeta=${publicBetaLane?.returnStatus ?? "missing"}; human=${humanLane?.returnStatus ?? "missing"}; betaCommand=${publicBetaLane?.nextRequiredCommand ?? "missing"}; humanCommand=${humanLane?.nextRequiredCommand ?? "missing"}`
  );

  push(
    checks,
    "Return gate blocks release, model activation, all-software, and premature additional invites",
    gate?.blockedActions?.includes("release_product") === true &&
      gate.blockedActions.includes("unlock_packaging") &&
      gate.blockedActions.includes("activate_real_model") &&
      gate.blockedActions.includes("resume_all_software_scope") &&
      gate.blockedActions.includes("invite_additional_tester_or_reviewer_before_return_gate_allows_it"),
    `blocked=${gate?.blockedActions?.join(",") ?? "missing"}`
  );

  push(
    checks,
    "Return gate Markdown is readable and explicit",
    markdown.includes("# First Real Tester Return Gate") &&
      markdown.includes("Can invite additional tester or reviewer") &&
      markdown.includes("public_beta_tester_session") &&
      markdown.includes("Return Workbench") &&
      markdown.includes("first-real-tester-return-workbench.md") &&
      markdown.includes("Send bundle fingerprint gate") &&
      markdown.includes("first-real-tester-send-receipt-validation.json") &&
      markdown.includes("human_acceptance_review") &&
      markdown.includes("accepted`)" ) === false &&
      markdown.includes("Accepted: `false`") &&
      markdown.includes("Packaging gated: `true`") &&
      markdown.includes("Can release: `false`") &&
      markdown.includes("Can activate real model: `false`"),
    `bytes=${markdown.length}`
  );

  const passed = checks.filter((check) => check.pass).length;
  const verification = {
    responseMode: "first_real_tester_return_gate_verification_json_v1",
    status: passed === checks.length ? "passed" : "failed",
    generatedAt: new Date().toISOString(),
    command: "npm run verify:first-real-tester-return-gate",
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
        ? "Use first-real-tester-return-gate.md after the first real tester or reviewer returns evidence; do not invite anyone else until this gate allows it."
        : "Rebuild first-real-tester-return-gate and fix failed checks before widening testing."
  };

  fs.writeFileSync(verificationPath, `${JSON.stringify(verification, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(verification, null, 2));
  console.log(`\nFirst real tester return gate verification written to ${verificationPath}`);

  if (verification.status !== "passed") process.exitCode = 1;
}

try {
  main();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}

export {};
