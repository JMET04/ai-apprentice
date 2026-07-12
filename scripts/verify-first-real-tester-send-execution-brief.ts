import fs from "node:fs";
import path from "node:path";

type Check = { name: string; pass: boolean; evidence: string };

type Brief = {
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
  manualSendAllowed?: boolean;
  actualSendPerformed?: boolean;
  selectedLane?: { id?: string; preflightEvidencePath?: string };
  outboundScope?: {
    exactlyOneExternalPerson?: boolean;
    externalSendFolder?: string;
    forbiddenFolders?: string[];
    sendFiles?: Array<{ bundlePath?: string; expectedBytes?: number; expectedSha256?: string }>;
  };
  operatorFillAfterManualSend?: { receiptTemplatePath?: string; receiptMarkdownPath?: string; receiptFieldsToFill?: string[]; materialConfirmations?: string[]; negativeAssertionsToConfirm?: string[]; validationCommand?: string; validationEvidencePath?: string; validationFailureFields?: string[] };
  blockedActions?: string[];
  checks?: Array<{ name?: string; pass?: boolean; requiredForManualSend?: boolean; evidence?: string }>;
  failedRequiredChecks?: string[];
  nextAction?: string;
};

type ContactReadiness = { status?: string; contactAllowed?: boolean; contactDecision?: string; actualSendPerformed?: boolean; releaseDecision?: string; accepted?: boolean; packagingGated?: boolean; canRelease?: boolean; canActivateRealModel?: boolean };
type SendBundle = { status?: string; selectedLane?: { id?: string }; externalSendFolder?: string; sendFiles?: Array<{ bundlePath?: string; bytes?: number; sha256?: string }>; actualSendPerformed?: boolean };
type ReceiptTemplate = { status?: string; defaultDecision?: string; sourceBundle?: { actualSendPerformed?: boolean }; receiptFields?: { sentMaterials?: Array<{ bundlePath?: string; expectedBytes?: number; expectedSha256?: string; sent?: boolean }>; negativeAssertions?: Record<string, boolean> } };

const rootDir = process.cwd();
const artifactsDir = path.join(rootDir, "artifacts", "productization");
const briefPath = path.join(artifactsDir, "first-real-tester-send-execution-brief.json");
const markdownPath = path.join(artifactsDir, "first-real-tester-send-execution-brief.md");
const verificationPath = path.join(artifactsDir, "first-real-tester-send-execution-brief-verification.json");

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

function fileExists(relativePath: string, minBytes = 1) {
  const fullPath = path.join(rootDir, relativePath);
  return fs.existsSync(fullPath) && fs.statSync(fullPath).size >= minBytes;
}

function shaLooksValid(value: string | undefined) {
  return /^[a-f0-9]{64}$/.test(value ?? "");
}

function push(checks: Check[], name: string, pass: boolean, evidence: string) {
  checks.push({ name, pass, evidence });
}

function main() {
  const brief = readJson<Brief>(briefPath);
  const contact = readJson<ContactReadiness>(path.join(artifactsDir, "first-real-tester-contact-readiness.json"));
  const bundle = readJson<SendBundle>(path.join(artifactsDir, "first-real-tester-send-bundle.json"));
  const receipt = readJson<ReceiptTemplate>(path.join(artifactsDir, "first-real-tester-send-receipt.template.json"));
  const markdown = readText(markdownPath);
  const checks: Check[] = [];
  const expectedFiles = bundle?.sendFiles ?? [];
  const briefFiles = brief?.outboundScope?.sendFiles ?? [];
  const requiredBriefChecks = brief?.checks?.filter((check) => check.requiredForManualSend) ?? [];

  push(
    checks,
    "Execution brief exists and is ready for manual send",
    brief?.responseMode === "first_real_tester_send_execution_brief_json_v1" &&
      brief.status === "ready_for_manual_send_execution" &&
      brief.manualSendAllowed === true &&
      brief.actualSendPerformed === false &&
      (brief.failedRequiredChecks?.length ?? 1) === 0,
    `status=${brief?.status ?? "missing"}; allowed=${brief?.manualSendAllowed ?? "missing"}; actualSend=${brief?.actualSendPerformed ?? "missing"}; failed=${brief?.failedRequiredChecks?.join(",") || "none"}`
  );

  push(
    checks,
    "Execution brief is backed by current contact readiness",
    contact?.status === "ready_to_contact_first_external_person" &&
      contact.contactAllowed === true &&
      contact.contactDecision === "may_contact_exactly_one_person" &&
      contact.actualSendPerformed === false,
    `contact=${contact?.status ?? "missing"}; allowed=${contact?.contactAllowed ?? "missing"}; decision=${contact?.contactDecision ?? "missing"}; sent=${contact?.actualSendPerformed ?? "missing"}`
  );

  push(
    checks,
    "Execution brief sends only the selected external folder",
    brief?.outboundScope?.exactlyOneExternalPerson === true &&
      brief.outboundScope.externalSendFolder === "artifacts/productization/first-real-tester-send-bundle/SEND_TO_FIRST_EXTERNAL_PERSON" &&
      bundle?.externalSendFolder === brief.outboundScope.externalSendFolder &&
      briefFiles.length === expectedFiles.length &&
      briefFiles.every((file) =>
        typeof file.bundlePath === "string" &&
        file.bundlePath.startsWith("SEND_TO_FIRST_EXTERNAL_PERSON/") &&
        shaLooksValid(file.expectedSha256) &&
        fileExists(path.join("artifacts/productization/first-real-tester-send-bundle", file.bundlePath), 1)
      ),
    `folder=${brief?.outboundScope?.externalSendFolder ?? "missing"}; files=${briefFiles.map((file) => file.bundlePath ?? "missing").join(",") || "none"}`
  );

  push(
    checks,
    "Execution brief preserves receipt validation handoff",
    receipt?.status === "template_ready" &&
      receipt.defaultDecision === "not_sent_yet" &&
      receipt.sourceBundle?.actualSendPerformed === false &&
      brief?.operatorFillAfterManualSend?.receiptTemplatePath === "artifacts/productization/first-real-tester-send-receipt.template.json" &&
      brief.operatorFillAfterManualSend.receiptMarkdownPath === "artifacts/productization/first-real-tester-send-receipt-template.md" &&
      brief.operatorFillAfterManualSend.validationCommand === "npm run verify:first-real-tester-send-receipt-template -- --receipt <path>" &&
      brief.operatorFillAfterManualSend.validationEvidencePath === "artifacts/productization/first-real-tester-send-receipt-validation.json" &&
      brief.operatorFillAfterManualSend.validationFailureFields?.includes("failedChecks") === true &&
      brief.operatorFillAfterManualSend.validationFailureFields.includes("remediationActions") &&
      brief.operatorFillAfterManualSend.validationFailureFields.includes("nextAction"),
    `receipt=${receipt?.status ?? "missing"}; decision=${receipt?.defaultDecision ?? "missing"}; validation=${brief?.operatorFillAfterManualSend?.validationEvidencePath ?? "missing"}`
  );


  const receiptFieldsToFill = brief?.operatorFillAfterManualSend?.receiptFieldsToFill ?? [];
  const materialConfirmations = brief?.operatorFillAfterManualSend?.materialConfirmations ?? [];
  const negativeAssertionsToConfirm = brief?.operatorFillAfterManualSend?.negativeAssertionsToConfirm ?? [];
  const receiptNegativeAssertions = Object.keys(receipt?.receiptFields?.negativeAssertions ?? {});

  push(
    checks,
    "Execution brief names actual send receipt schema fields",
    receiptFieldsToFill.includes("receiptFields.decision=sent_manually") &&
      receiptFieldsToFill.includes("receiptFields.maintainerNameOrRole") &&
      receiptFieldsToFill.includes("receiptFields.firstExternalPersonRole") &&
      receiptFieldsToFill.includes("receiptFields.contactChannel") &&
      receiptFieldsToFill.includes("receiptFields.sendTimestampIso") &&
      receiptFieldsToFill.includes("receiptFields.preflight.commandRun=true") &&
      receiptFieldsToFill.includes("receiptFields.preflight.resultStatus=passed") &&
      materialConfirmations.some((item) => item.includes("receiptFields.sentMaterials[].sent=true")) &&
      materialConfirmations.some((item) => item.includes("receiptFields.retainedByMaintainer[].retained=true")) &&
      receiptNegativeAssertions.length > 0 &&
      receiptNegativeAssertions.every((key) => negativeAssertionsToConfirm.includes(key)) &&
      markdown.includes("receiptFields.maintainerNameOrRole") &&
      markdown.includes("receiptFields.firstExternalPersonRole") &&
      markdown.includes("receiptFields.contactChannel") &&
      markdown.includes("receiptFields.sendTimestampIso") &&
      !markdown.includes("recipientName") &&
      !markdown.includes("recipientContact") &&
      !markdown.includes("sendChannel") &&
      !markdown.includes("sentAt") &&
      !markdown.includes("sentBy"),
    `fields=${receiptFieldsToFill.join(",") || "missing"}; negative=${negativeAssertionsToConfirm.length}/${receiptNegativeAssertions.length}; oldFields=${["recipientName", "recipientContact", "sendChannel", "sentAt", "sentBy"].filter((field) => markdown.includes(field)).join(",") || "none"}`
  );
  push(
    checks,
    "Execution brief preserves productization locks",
    brief?.releaseDecision === "do_not_release" &&
      brief.accepted === false &&
      brief.packagingGated === true &&
      brief.canRelease === false &&
      brief.canActivateRealModel === false &&
      brief.allSoftwareObjective === "paused" &&
      contact?.releaseDecision === "do_not_release" &&
      contact.accepted === false &&
      contact.packagingGated === true &&
      contact.canRelease === false &&
      contact.canActivateRealModel === false,
    `release=${brief?.releaseDecision ?? "missing"}; accepted=${brief?.accepted ?? "missing"}; packaging=${brief?.packagingGated ?? "missing"}; canRelease=${brief?.canRelease ?? "missing"}; model=${brief?.canActivateRealModel ?? "missing"}`
  );

  push(
    checks,
    "Execution brief blocks unsafe send transitions",
    brief?.blockedActions?.includes("send_more_than_one_person") === true &&
      brief.blockedActions.includes("send_keep_for_return_intake_folder") &&
      brief.blockedActions.includes("claim_acceptance_from_manual_send") &&
      brief.blockedActions.includes("invite_second_person_before_return_gate") &&
      requiredBriefChecks.length >= 5 &&
      requiredBriefChecks.every((check) => check.pass === true),
    `blocked=${brief?.blockedActions?.join(",") ?? "missing"}; checks=${requiredBriefChecks.filter((check) => check.pass).length}/${requiredBriefChecks.length}`
  );

  push(
    checks,
    "Execution brief Markdown is readable and explicit",
    fileExists("artifacts/productization/first-real-tester-send-execution-brief.md", 1000) &&
      markdown.includes("Manual send allowed: `true`") &&
      markdown.includes("Actual send performed: `false`") &&
      markdown.includes("SEND_TO_FIRST_EXTERNAL_PERSON") &&
      markdown.includes("first-real-tester-send-receipt-validation.json") &&
      markdown.includes("failedChecks") &&
      markdown.includes("remediationActions") &&
      markdown.includes("Do Not Send"),
    `bytes=${Buffer.byteLength(markdown, "utf8")}`
  );

  const passed = checks.filter((check) => check.pass).length;
  const receiptOut = {
    responseMode: "first_real_tester_send_execution_brief_verification_json_v1",
    status: passed === checks.length ? "passed" : "failed",
    generatedAt: new Date().toISOString(),
    command: "npm run verify:first-real-tester-send-execution-brief",
    productScope: "bounded_core_teaching_loop",
    allSoftwareObjective: "paused",
    releaseDecision: "do_not_release",
    reviewOnly: true,
    accepted: false,
    packagingGated: true,
    canRelease: false,
    canActivateRealModel: false,
    manualSendAllowed: brief?.manualSendAllowed === true,
    actualSendPerformed: false,
    passed,
    total: checks.length,
    checks,
    nextAction: passed === checks.length ? "Manually send exactly one external folder, validate the filled send receipt, and follow remediationActions if validation fails." : "Fix failed execution-brief checks before manual send."
  };

  fs.writeFileSync(verificationPath, `${JSON.stringify(receiptOut, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(receiptOut, null, 2));
  console.log(`\nFirst real tester send execution brief verification written to ${verificationPath}`);
  if (receiptOut.status !== "passed") process.exitCode = 1;
}

main();
