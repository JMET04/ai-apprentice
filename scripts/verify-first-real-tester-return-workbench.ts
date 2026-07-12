import fs from "node:fs";
import path from "node:path";

type Check = { name: string; pass: boolean; evidence: string };

const artifactsDir = path.join(process.cwd(), "artifacts", "productization");
const workbenchJsonPath = path.join(artifactsDir, "first-real-tester-return-workbench.json");
const workbenchMarkdownPath = path.join(artifactsDir, "first-real-tester-return-workbench.md");
const verificationPath = path.join(artifactsDir, "first-real-tester-return-workbench-verification.json");

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

function push(checks: Check[], name: string, pass: boolean, evidence: string) {
  checks.push({ name, pass, evidence });
}

function main() {
  const workbench = readJson<{
    responseMode?: string;
    status?: string;
    releaseDecision?: string;
    allSoftwareObjective?: string;
    reviewOnly?: boolean;
    accepted?: boolean;
    packagingGated?: boolean;
    canRelease?: boolean;
    canActivateRealModel?: boolean;
    sourceEvidence?: Record<string, string>;
    sendReceiptHandoff?: {
      requiredBeforeReturnIntake?: boolean;
      selectedLane?: string;
      sendBundleVerification?: string;
      sendBundleFingerprintGate?: string;
      sendReceiptTemplateVerification?: string;
      submittedSendReceiptValidation?: string;
      validationCommand?: string;
      validationEvidencePath?: string;
      stopCondition?: string;
    };
    operatorRule?: {
      chooseExactlyOneReturnedLane?: boolean;
      doNotInviteAnyoneElseBeforeGate?: boolean;
      verifyManualSendReceiptBeforeReturnIntake?: boolean;
      manualSendReceiptValidationCommand?: string;
      manualSendReceiptValidationEvidencePath?: string;
      finalGateCommand?: string;
      finalGateEvidencePath?: string;
    };
    returnedLaneWorkflows?: Array<{
      id?: string;
      incomingFiles?: Array<{ id?: string; required?: boolean; templatePath?: string; validationCommand?: string }>;
      bindingChecks?: string[];
      processingCommands?: string[];
      outputEvidencePaths?: string[];
      continueCondition?: string;
      stopCondition?: string;
    }>;
    blockedActions?: string[];
    nextAction?: string;
  }>(workbenchJsonPath);
  const markdown = readText(workbenchMarkdownPath);
  const checks: Check[] = [];
  const lanes = workbench?.returnedLaneWorkflows ?? [];
  const betaLane = lanes.find((lane) => lane.id === "public_beta_tester_session");
  const humanLane = lanes.find((lane) => lane.id === "human_acceptance_review");

  push(
    checks,
    "Return workbench exists and is scoped to exactly one first return",
    workbench?.responseMode === "first_real_tester_return_workbench_json_v1" &&
      workbench.status === "ready_to_process_exactly_one_first_return" &&
      workbench.operatorRule?.chooseExactlyOneReturnedLane === true &&
      workbench.operatorRule.doNotInviteAnyoneElseBeforeGate === true &&
      lanes.length === 2,
    `status=${workbench?.status ?? "missing"}; lanes=${lanes.map((lane) => lane.id).join(",")}; oneLane=${
      workbench?.operatorRule?.chooseExactlyOneReturnedLane ?? "missing"
    }`
  );

  push(
    checks,
    "Return workbench preserves productization locks",
    workbench?.releaseDecision === "do_not_release" &&
      workbench.allSoftwareObjective === "paused" &&
      workbench.reviewOnly === true &&
      workbench.accepted === false &&
      workbench.packagingGated === true &&
      workbench.canRelease === false &&
      workbench.canActivateRealModel === false,
    `release=${workbench?.releaseDecision ?? "missing"}; accepted=${workbench?.accepted ?? "missing"}; packaging=${
      workbench?.packagingGated ?? "missing"
    }; canRelease=${workbench?.canRelease ?? "missing"}; canActivate=${workbench?.canActivateRealModel ?? "missing"}`
  );

  push(
    checks,
    "Return workbench is backed by launch and lane verifier evidence",
    workbench?.sourceEvidence?.firstRealTesterLaunch?.includes("ready_to_invite_one_bounded_real_tester_or_reviewer") ===
      true &&
      workbench.sourceEvidence.firstRealTesterLaunch.includes("verifier=passed 8/8") &&
      /^passed ([1-9][0-9]*)\/\1$/.test(workbench.sourceEvidence.publicBetaReturnIntakeVerifier ?? "") &&
      /^passed ([1-9][0-9]*)\/\1$/.test(workbench.sourceEvidence.humanAcceptanceReturnIntakeVerifier ?? "") &&
      workbench.sourceEvidence.publicBetaSessionReceiptTemplate === "template_ready 9/9" &&
      workbench.sourceEvidence.humanAcceptanceReceiptTemplate === "template_ready 7/7",
    `evidence=${JSON.stringify(workbench?.sourceEvidence ?? {})}`
  );

  push(
    checks,
    "Return workbench binds return intake to verified send receipt handoff",
    workbench?.sendReceiptHandoff?.requiredBeforeReturnIntake === true &&
      workbench.sendReceiptHandoff.selectedLane === "public_beta_tester_session" &&
      workbench.sendReceiptHandoff.sendBundleVerification === "passed 9/9" &&
      workbench.sendReceiptHandoff.sendBundleFingerprintGate === "sha256-bound" &&
      workbench.sendReceiptHandoff.sendReceiptTemplateVerification === "passed 9/9" &&
      workbench.sendReceiptHandoff.submittedSendReceiptValidation?.includes("not_submitted_yet") === true &&
      workbench.sendReceiptHandoff.validationCommand ===
        "npm run verify:first-real-tester-send-receipt-template -- --receipt <filled-send-receipt-path>" &&
      workbench.sendReceiptHandoff.validationEvidencePath ===
        "artifacts/productization/first-real-tester-send-receipt-validation.json" &&
      workbench.operatorRule?.verifyManualSendReceiptBeforeReturnIntake === true &&
      workbench.operatorRule.manualSendReceiptValidationCommand === workbench.sendReceiptHandoff.validationCommand &&
      workbench.sourceEvidence?.firstRealTesterSendBundle?.includes("fingerprint=sha256-bound") === true &&
      workbench.sourceEvidence.firstRealTesterSendReceiptTemplate?.includes("passed 9/9") === true,
    `sendBundle=${workbench?.sendReceiptHandoff?.sendBundleVerification ?? "missing"}; fingerprint=${
      workbench?.sendReceiptHandoff?.sendBundleFingerprintGate ?? "missing"
    }; sendReceipt=${workbench?.sendReceiptHandoff?.sendReceiptTemplateVerification ?? "missing"}; submitted=${
      workbench?.sendReceiptHandoff?.submittedSendReceiptValidation ?? "missing"
    }`
  );

  push(
    checks,
    "Public beta returned lane requires feedback and session receipts plus binding",
    betaLane?.incomingFiles?.some((file) => file.id === "filled_public_beta_feedback_receipt" && file.required === true) ===
      true &&
      betaLane.incomingFiles.some((file) => file.id === "filled_public_beta_session_receipt" && file.required === true) &&
      betaLane.processingCommands?.includes(
        "npm run intake:public-beta-return -- --receipt <feedback-path> --session-receipt <session-receipt-path> --send-receipt-validation artifacts/productization/first-real-tester-send-receipt-validation.json"
      ) === true &&
      betaLane.processingCommands.includes("npm run verify:public-beta-return-intake") &&
      betaLane.processingCommands.includes("npm run build:first-real-tester-return-gate") &&
      betaLane.bindingChecks?.some((item) => item.includes("tester.name")) === true &&
      betaLane.bindingChecks.some((item) => item.includes("tester.date")) &&
      betaLane.bindingChecks.some((item) => item.includes("sessionEvidence.feedbackReceiptPath")) &&
      betaLane.bindingChecks.some((item) => item.includes("first-real-tester-send-receipt-validation.json")) &&
      betaLane.stopCondition?.includes("release") === true,
    `incoming=${betaLane?.incomingFiles?.length ?? 0}; commands=${betaLane?.processingCommands?.length ?? 0}; checks=${
      betaLane?.bindingChecks?.length ?? 0
    }`
  );

  push(
    checks,
    "Human acceptance returned lane requires saved human_review evidence and keeps release locked",
    humanLane?.incomingFiles?.some((file) => file.id === "filled_human_acceptance_receipt" && file.required === true) ===
      true &&
      humanLane.processingCommands?.includes("npm run intake:human-acceptance-return -- --receipt <path> --send-receipt-validation artifacts/productization/first-real-tester-send-receipt-validation.json") === true &&
      humanLane.processingCommands.includes("npm run verify:human-acceptance-return-intake") &&
      humanLane.processingCommands.includes("npm run verify:human-acceptance") &&
      humanLane.processingCommands.includes("npm run build:first-real-tester-return-gate") &&
      humanLane.bindingChecks?.some((item) => item.includes("evidenceKind=human_review")) === true &&
      humanLane.bindingChecks.some((item) => item.includes("humanReviewed=true")) &&
      humanLane.bindingChecks.some((item) => item.includes("first-real-tester-send-receipt-validation.json")) &&
      humanLane.stopCondition?.includes("real-model acceptance") === true,
    `incoming=${humanLane?.incomingFiles?.length ?? 0}; commands=${humanLane?.processingCommands?.length ?? 0}; checks=${
      humanLane?.bindingChecks?.length ?? 0
    }`
  );

  push(
    checks,
    "Return workbench blocks premature widening and release transitions",
    workbench?.blockedActions?.includes("process_two_first_returns_at_once") === true &&
      workbench.blockedActions.includes("invite_additional_tester_or_reviewer_without_return_gate") &&
      workbench.blockedActions.includes("release_product") &&
      workbench.blockedActions.includes("unlock_packaging") &&
      workbench.blockedActions.includes("activate_real_model") &&
      workbench.blockedActions.includes("resume_all_software_scope") &&
      workbench.operatorRule?.finalGateCommand ===
        "npm run build:first-real-tester-return-gate && npm run verify:first-real-tester-return-gate" &&
      workbench.operatorRule.finalGateEvidencePath === "artifacts/productization/first-real-tester-return-gate.json",
    `blocked=${workbench?.blockedActions?.join(",") ?? "missing"}; finalGate=${
      workbench?.operatorRule?.finalGateCommand ?? "missing"
    }`
  );

  push(
    checks,
    "Return workbench Markdown is readable and explicit",
    markdown.includes("# First Real Tester Return Workbench") &&
      markdown.includes("public_beta_tester_session") &&
      markdown.includes("human_acceptance_review") &&
      markdown.includes("Processing commands") &&
      markdown.includes("Send Receipt Handoff") &&
      markdown.includes("sha256-bound") &&
      markdown.includes("first-real-tester-send-receipt-validation.json") &&
      markdown.includes("Accepted: `false`") &&
      markdown.includes("Packaging gated: `true`") &&
      markdown.includes("Can release: `false`") &&
      markdown.includes("Can activate real model: `false`") &&
      markdown.length > 2500,
    `bytes=${markdown.length}`
  );

  const passed = checks.filter((check) => check.pass).length;
  const verification = {
    responseMode: "first_real_tester_return_workbench_verification_json_v1",
    status: passed === checks.length ? "passed" : "failed",
    generatedAt: new Date().toISOString(),
    command: "npm run verify:first-real-tester-return-workbench",
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
        ? "Use first-real-tester-return-workbench.md after validating the filled manual-send receipt, then process exactly one returned lane and rebuild the return gate before widening."
        : "Rebuild first-real-tester-return-workbench and fix failed checks before processing first-return evidence."
  };

  fs.writeFileSync(verificationPath, `${JSON.stringify(verification, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(verification, null, 2));
  console.log(`\nFirst real tester return workbench verification written to ${verificationPath}`);

  if (verification.status !== "passed") process.exitCode = 1;
}

try {
  main();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}

export {};
