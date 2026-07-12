import * as fs from "node:fs";
import * as path from "node:path";

const artifactsDir = path.join("artifacts", "productization");
const goNoGoPath = path.join(artifactsDir, "first-real-tester-final-go-no-go.json");
const goNoGoMarkdownPath = path.join(artifactsDir, "first-real-tester-final-go-no-go.md");
const verificationPath = path.join(artifactsDir, "first-real-tester-final-go-no-go-verification.json");

type Check = { name: string; pass: boolean; evidence: string };
type SourceCheck = { name?: string; pass?: boolean; evidence?: string; requiredForGo?: boolean };
type GoNoGo = {
  responseMode?: string;
  status?: string;
  generatedAt?: string;
  command?: string;
  productScope?: string;
  allSoftwareObjective?: string;
  releaseDecision?: string;
  reviewOnly?: boolean;
  accepted?: boolean;
  packagingGated?: boolean;
  canRelease?: boolean;
  canActivateRealModel?: boolean;
  selectedLane?: string;
  manualSendAllowed?: boolean;
  actualSendPerformed?: boolean;
  externalSendFolder?: string;
  validationEvidencePath?: string;
  returnGatePath?: string;
  checks?: SourceCheck[];
  failedRequiredChecks?: string[];
  operatorFinalAssertions?: string[];
  nextAction?: string;
};

type LockedArtifact = {
  status?: string;
  releaseDecision?: string;
  allSoftwareObjective?: string;
  accepted?: boolean;
  packagingGated?: boolean;
  canRelease?: boolean;
  canActivateRealModel?: boolean;
};
type SendBundle = LockedArtifact & { selectedLane?: { id?: string }; externalSendFolder?: string; actualSendPerformed?: boolean };
type ContactReadiness = LockedArtifact & { selectedLane?: { id?: string }; contactAllowed?: boolean; actualSendPerformed?: boolean };
type SendExecutionBrief = LockedArtifact & {
  selectedLane?: { id?: string };
  manualSendAllowed?: boolean;
  actualSendPerformed?: boolean;
  outboundScope?: { externalSendFolder?: string; exactlyOneExternalPerson?: boolean; sendFiles?: Array<{ bundlePath?: string; expectedSha256?: string }> };
  operatorFillAfterManualSend?: { validationEvidencePath?: string; validationFailureFields?: string[] };
  blockedActions?: string[];
};
type ReceiptTemplate = LockedArtifact & {
  status?: string;
  defaultDecision?: string;
  selectedLane?: { id?: string };
  sourceBundle?: { actualSendPerformed?: boolean };
  receiptFields?: { sentMaterials?: Array<{ sent?: boolean; expectedSha256?: string }>; negativeAssertions?: Record<string, boolean> };
};
type ReturnWorkbench = LockedArtifact & { status?: string; sendReceiptHandoff?: { requiredBeforeReturnIntake?: boolean; validationEvidencePath?: string } };
type ReturnGate = LockedArtifact & { status?: string; returnState?: { canInviteAdditionalTesterOrReviewer?: boolean } };

function readJson<T>(relativePath: string): T | null {
  try {
    return JSON.parse(fs.readFileSync(relativePath, "utf8")) as T;
  } catch {
    return null;
  }
}

function readText(relativePath: string) {
  try {
    return fs.readFileSync(relativePath, "utf8");
  } catch {
    return "";
  }
}

function push(checks: Check[], name: string, pass: boolean, evidence: string) {
  checks.push({ name, pass, evidence });
}

function locked(value: LockedArtifact | null | undefined) {
  return (
    value?.releaseDecision === "do_not_release" &&
    value?.allSoftwareObjective === "paused" &&
    value?.accepted === false &&
    value?.packagingGated === true &&
    value?.canRelease === false &&
    value?.canActivateRealModel === false
  );
}

function shaLooksValid(value: string | undefined) {
  return /^[a-f0-9]{64}$/.test(value ?? "");
}

function fileExistsWithSize(relativePath: string, minBytes: number) {
  try {
    return fs.statSync(relativePath).size >= minBytes;
  } catch {
    return false;
  }
}

function main() {
  const goNoGo = readJson<GoNoGo>(goNoGoPath);
  const markdown = readText(goNoGoMarkdownPath);
  const sendBundle = readJson<SendBundle>(path.join(artifactsDir, "first-real-tester-send-bundle.json"));
  const contact = readJson<ContactReadiness>(path.join(artifactsDir, "first-real-tester-contact-readiness.json"));
  const brief = readJson<SendExecutionBrief>(path.join(artifactsDir, "first-real-tester-send-execution-brief.json"));
  const receipt = readJson<ReceiptTemplate>(path.join(artifactsDir, "first-real-tester-send-receipt.template.json"));
  const workbench = readJson<ReturnWorkbench>(path.join(artifactsDir, "first-real-tester-return-workbench.json"));
  const returnGate = readJson<ReturnGate>(path.join(artifactsDir, "first-real-tester-return-gate.json"));

  const checks: Check[] = [];
  const sourceChecks = goNoGo?.checks ?? [];
  const failedRequired = goNoGo?.failedRequiredChecks ?? [];
  const briefFiles = brief?.outboundScope?.sendFiles ?? [];
  const receiptSentMaterials = receipt?.receiptFields?.sentMaterials ?? [];

  push(
    checks,
    "Final go/no-go artifact exists and is ready",
    goNoGo?.responseMode === "first_real_tester_final_go_no_go_json_v1" &&
      goNoGo.status === "ready_for_one_manual_send" &&
      goNoGo.manualSendAllowed === true &&
      goNoGo.actualSendPerformed === false &&
      failedRequired.length === 0 &&
      sourceChecks.length >= 8 &&
      sourceChecks.every((check) => check.pass === true),
    `status=${goNoGo?.status ?? "missing"}; manual=${goNoGo?.manualSendAllowed ?? "missing"}; actualSend=${goNoGo?.actualSendPerformed ?? "missing"}; checks=${sourceChecks.filter((check) => check.pass).length}/${sourceChecks.length}; failed=${failedRequired.join(",") || "none"}`
  );

  push(
    checks,
    "Final go/no-go preserves product locks",
    goNoGo?.releaseDecision === "do_not_release" &&
      goNoGo.allSoftwareObjective === "paused" &&
      goNoGo.reviewOnly === true &&
      goNoGo.accepted === false &&
      goNoGo.packagingGated === true &&
      goNoGo.canRelease === false &&
      goNoGo.canActivateRealModel === false &&
      [sendBundle, contact, brief, receipt, workbench, returnGate].every(locked),
    `release=${goNoGo?.releaseDecision ?? "missing"}; accepted=${goNoGo?.accepted ?? "missing"}; packaging=${goNoGo?.packagingGated ?? "missing"}; sourceLocks=${[sendBundle, contact, brief, receipt, workbench, returnGate].map(locked).join(",")}`
  );

  push(
    checks,
    "Final go/no-go is bound to the selected public beta tester lane",
    goNoGo?.selectedLane === "public_beta_tester_session" &&
      sendBundle?.selectedLane?.id === goNoGo.selectedLane &&
      contact?.selectedLane?.id === goNoGo.selectedLane &&
      brief?.selectedLane?.id === goNoGo.selectedLane &&
      receipt?.selectedLane?.id === goNoGo.selectedLane,
    `go=${goNoGo?.selectedLane ?? "missing"}; bundle=${sendBundle?.selectedLane?.id ?? "missing"}; contact=${contact?.selectedLane?.id ?? "missing"}; brief=${brief?.selectedLane?.id ?? "missing"}; receipt=${receipt?.selectedLane?.id ?? "missing"}`
  );

  push(
    checks,
    "Final go/no-go sends only the external folder and keeps all source states unsent",
    goNoGo?.externalSendFolder === "artifacts/productization/first-real-tester-send-bundle/SEND_TO_FIRST_EXTERNAL_PERSON" &&
      sendBundle?.externalSendFolder === goNoGo.externalSendFolder &&
      contact?.contactAllowed === true &&
      contact.actualSendPerformed === false &&
      brief?.manualSendAllowed === true &&
      brief.actualSendPerformed === false &&
      brief.outboundScope?.externalSendFolder === goNoGo.externalSendFolder &&
      brief.outboundScope.exactlyOneExternalPerson === true &&
      sendBundle.actualSendPerformed === false,
    `folder=${goNoGo?.externalSendFolder ?? "missing"}; contact=${contact?.contactAllowed ?? "missing"}; brief=${brief?.manualSendAllowed ?? "missing"}; sent=${sendBundle?.actualSendPerformed ?? "missing"}`
  );

  push(
    checks,
    "Final go/no-go carries SHA-bound material and receipt validation handoff",
    briefFiles.length >= 3 &&
      briefFiles.every((file) => (file.bundlePath ?? "").startsWith("SEND_TO_FIRST_EXTERNAL_PERSON/") && shaLooksValid(file.expectedSha256)) &&
      receipt?.status === "template_ready" &&
      receipt.defaultDecision === "not_sent_yet" &&
      receipt.sourceBundle?.actualSendPerformed === false &&
      receiptSentMaterials.length === briefFiles.length &&
      receiptSentMaterials.every((file) => file.sent === false && shaLooksValid(file.expectedSha256)) &&
      brief?.operatorFillAfterManualSend?.validationEvidencePath === "artifacts/productization/first-real-tester-send-receipt-validation.json" &&
      goNoGo?.validationEvidencePath === "artifacts/productization/first-real-tester-send-receipt-validation.json",
    `files=${briefFiles.length}; receipt=${receipt?.status ?? "missing"}; validation=${goNoGo?.validationEvidencePath ?? "missing"}`
  );

  push(
    checks,
    "Final go/no-go keeps first return and widening gated",
    workbench?.status === "ready_to_process_exactly_one_first_return" &&
      workbench.sendReceiptHandoff?.requiredBeforeReturnIntake === true &&
      workbench.sendReceiptHandoff.validationEvidencePath === "artifacts/productization/first-real-tester-send-receipt-validation.json" &&
      returnGate?.status === "waiting_for_first_return" &&
      returnGate.returnState?.canInviteAdditionalTesterOrReviewer === false &&
      goNoGo?.returnGatePath === "artifacts/productization/first-real-tester-return-gate.md",
    `workbench=${workbench?.status ?? "missing"}; returnGate=${returnGate?.status ?? "missing"}; canInvite=${returnGate?.returnState?.canInviteAdditionalTesterOrReviewer ?? "missing"}`
  );

  push(
    checks,
    "Final go/no-go blocks release, model activation, acceptance, and second invite",
    (brief?.blockedActions ?? []).includes("send_more_than_one_person") &&
      (brief?.blockedActions ?? []).includes("send_release_approval_or_real_model_materials") &&
      (brief?.blockedActions ?? []).includes("claim_acceptance_from_manual_send") &&
      (brief?.blockedActions ?? []).includes("invite_second_person_before_return_gate") &&
      (goNoGo?.operatorFinalAssertions ?? []).some((item) => item.includes("Do not invite anyone else")),
    `blocked=${brief?.blockedActions?.join(",") ?? "missing"}; assertions=${goNoGo?.operatorFinalAssertions?.length ?? 0}`
  );

  push(
    checks,
    "Final go/no-go Markdown is readable and explicit",
    fileExistsWithSize(goNoGoMarkdownPath, 1000) &&
      markdown.includes("# First Real Tester Final Go/No-Go") &&
      markdown.includes("Manual send allowed: `true`") &&
      markdown.includes("Actual send performed: `false`") &&
      markdown.includes("SEND_TO_FIRST_EXTERNAL_PERSON") &&
      markdown.includes("first-real-tester-send-receipt-validation.json") &&
      markdown.includes("Do not send KEEP_FOR_RETURN_INTAKE") &&
      markdown.includes("Do not invite anyone else"),
    `bytes=${Buffer.byteLength(markdown, "utf8")}`
  );

  const passed = checks.filter((check) => check.pass).length;
  const receiptOut = {
    responseMode: "first_real_tester_final_go_no_go_verification_json_v1",
    status: passed === checks.length ? "passed" : "failed",
    generatedAt: new Date().toISOString(),
    command: "npm run verify:first-real-tester-final-go-no-go",
    productScope: "bounded_core_teaching_loop",
    allSoftwareObjective: "paused",
    releaseDecision: "do_not_release",
    reviewOnly: true,
    accepted: false,
    packagingGated: true,
    canRelease: false,
    canActivateRealModel: false,
    manualSendAllowed: goNoGo?.manualSendAllowed === true,
    actualSendPerformed: false,
    passed,
    total: checks.length,
    checks,
    nextAction:
      passed === checks.length
        ? "Use first-real-tester-final-go-no-go.md as the final operator check immediately before exactly one manual send."
        : "Fix failed final go/no-go checks before contacting any external tester or reviewer."
  };

  fs.writeFileSync(verificationPath, `${JSON.stringify(receiptOut, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(receiptOut, null, 2));
  console.log(`\nFirst real tester final go/no-go verification written to ${verificationPath}`);
  if (receiptOut.status !== "passed") process.exitCode = 1;
}

main();
