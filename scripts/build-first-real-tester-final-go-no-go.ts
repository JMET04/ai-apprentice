import * as fs from "node:fs";
import * as path from "node:path";

const artifactsDir = path.join("artifacts", "productization");
const outputPath = path.join(artifactsDir, "first-real-tester-final-go-no-go.json");
const markdownPath = path.join(artifactsDir, "first-real-tester-final-go-no-go.md");

type Check = { name: string; pass: boolean; evidence: string; requiredForGo: boolean; nextAction?: string };

type LockedArtifact = {
  responseMode?: string;
  status?: string;
  generatedAt?: string;
  releaseDecision?: string;
  allSoftwareObjective?: string;
  reviewOnly?: boolean;
  accepted?: boolean;
  packagingGated?: boolean;
  canRelease?: boolean;
  canActivateRealModel?: boolean;
};

type Preflight = LockedArtifact & { canInviteTester?: boolean; passed?: number; total?: number };
type Dispatch = LockedArtifact & { lanes?: Array<{ id?: string }>; dispatchDecision?: string };
type SendBundle = LockedArtifact & {
  selectedLane?: { id?: string; preflightCommand?: string; preflightEvidencePath?: string };
  externalSendFolder?: string;
  returnIntakeFolder?: string;
  actualSendPerformed?: boolean;
  sendFiles?: Array<{ bundlePath?: string; bytes?: number; sha256?: string }>;
};
type ContactReadiness = LockedArtifact & {
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
};
type SendExecutionBrief = LockedArtifact & {
  manualSendAllowed?: boolean;
  actualSendPerformed?: boolean;
  selectedLane?: { id?: string; preflightEvidencePath?: string };
  outboundScope?: {
    exactlyOneExternalPerson?: boolean;
    externalSendFolder?: string;
    forbiddenFolders?: string[];
    sendFiles?: Array<{ bundlePath?: string; expectedBytes?: number; expectedSha256?: string }>;
  };
  operatorFillAfterManualSend?: {
    receiptTemplatePath?: string;
    receiptMarkdownPath?: string;
    validationCommand?: string;
    validationEvidencePath?: string;
    validationFailureFields?: string[];
  };
  blockedActions?: string[];
  failedRequiredChecks?: string[];
};
type SendReceiptTemplate = LockedArtifact & {
  status?: string;
  defaultDecision?: string;
  selectedLane?: { id?: string };
  sourceBundle?: { actualSendPerformed?: boolean; externalSendFolder?: string; returnIntakeFolder?: string };
  receiptFields?: {
    sentMaterials?: Array<{ bundlePath?: string; sent?: boolean; expectedBytes?: number; expectedSha256?: string }>;
    retainedByMaintainer?: Array<{ bundlePath?: string; retained?: boolean; expectedBytes?: number; expectedSha256?: string }>;
    negativeAssertions?: Record<string, boolean>;
  };
  validationFailureHandoff?: { failedChecksField?: string; remediationActionsField?: string; nextActionField?: string };
};
type ReturnWorkbench = LockedArtifact & {
  status?: string;
  sendReceiptHandoff?: {
    requiredBeforeReturnIntake?: boolean;
    validationCommand?: string;
    validationEvidencePath?: string;
    sendBundleFingerprintGate?: string;
  };
  operatorRule?: {
    chooseExactlyOneReturnedLane?: boolean;
    doNotInviteAnyoneElseBeforeGate?: boolean;
    verifyManualSendReceiptBeforeReturnIntake?: boolean;
  };
};
type ReturnGate = LockedArtifact & {
  status?: string;
  returnState?: { canInviteAdditionalTesterOrReviewer?: boolean };
};

function readJson<T>(relativePath: string): T | null {
  try {
    return JSON.parse(fs.readFileSync(relativePath, "utf8")) as T;
  } catch {
    return null;
  }
}

function timestampMs(value: string | undefined) {
  if (!value) return Number.NaN;
  return Date.parse(value);
}

function shaLooksValid(value: string | undefined) {
  return /^[a-f0-9]{64}$/.test(value ?? "");
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

function preflightLocked(value: Preflight | null | undefined) {
  return (
    value?.releaseDecision === "do_not_release" &&
    value?.allSoftwareObjective === "paused" &&
    value?.reviewOnly === true &&
    value?.accepted === false &&
    value?.packagingGated === true
  );
}

function statusLine(value: { status?: string; passed?: number; total?: number } | null | undefined) {
  return `${value?.status ?? "missing"} ${value?.passed ?? "?"}/${value?.total ?? "?"}`;
}

function push(checks: Check[], name: string, pass: boolean, evidence: string, nextAction?: string) {
  checks.push({ name, pass, evidence, requiredForGo: true, nextAction });
}

function markdownList(items: string[]) {
  return items.map((item) => `- ${item}`).join("\n");
}

function main() {
  const preflight = readJson<Preflight>(path.join(artifactsDir, "public-beta-tester-session-preflight.json"));
  const dispatch = readJson<Dispatch>(path.join(artifactsDir, "first-real-tester-dispatch-packet.json"));
  const sendBundle = readJson<SendBundle>(path.join(artifactsDir, "first-real-tester-send-bundle.json"));
  const contact = readJson<ContactReadiness>(path.join(artifactsDir, "first-real-tester-contact-readiness.json"));
  const brief = readJson<SendExecutionBrief>(path.join(artifactsDir, "first-real-tester-send-execution-brief.json"));
  const receipt = readJson<SendReceiptTemplate>(path.join(artifactsDir, "first-real-tester-send-receipt.template.json"));
  const workbench = readJson<ReturnWorkbench>(path.join(artifactsDir, "first-real-tester-return-workbench.json"));
  const returnGate = readJson<ReturnGate>(path.join(artifactsDir, "first-real-tester-return-gate.json"));

  const checks: Check[] = [];
  const selectedLane = sendBundle?.selectedLane?.id ?? contact?.selectedLane?.id ?? "missing";
  const preflightFresh =
    Number.isFinite(timestampMs(preflight?.generatedAt)) &&
    Number.isFinite(timestampMs(sendBundle?.generatedAt)) &&
    timestampMs(preflight?.generatedAt) >= timestampMs(sendBundle?.generatedAt);
  const sentMaterials = receipt?.receiptFields?.sentMaterials ?? [];
  const briefFiles = brief?.outboundScope?.sendFiles ?? [];
  const negativeAssertionValues = Object.values(receipt?.receiptFields?.negativeAssertions ?? {});

  push(
    checks,
    "All final-send inputs preserve product locks",
    preflightLocked(preflight) && [dispatch, sendBundle, contact, brief, receipt, workbench, returnGate].every(locked),
    `preflight=${preflightLocked(preflight)}; dispatch=${locked(dispatch)}; bundle=${locked(sendBundle)}; contact=${locked(contact)}; brief=${locked(brief)}; receipt=${locked(receipt)}; workbench=${locked(workbench)}; returnGate=${locked(returnGate)}`,
    "Refresh the first-real tester handoff chain and stop if any artifact changes release, packaging, model, or all-software locks."
  );

  push(
    checks,
    "Selected lane is consistent from dispatch through return workbench",
    selectedLane === "public_beta_tester_session" &&
      (dispatch?.lanes ?? []).some((lane) => lane.id === selectedLane) &&
      sendBundle?.selectedLane?.id === selectedLane &&
      contact?.selectedLane?.id === selectedLane &&
      brief?.selectedLane?.id === selectedLane &&
      receipt?.selectedLane?.id === selectedLane,
    `dispatchHasLane=${(dispatch?.lanes ?? []).some((lane) => lane.id === selectedLane)}; bundle=${sendBundle?.selectedLane?.id ?? "missing"}; contact=${contact?.selectedLane?.id ?? "missing"}; brief=${brief?.selectedLane?.id ?? "missing"}; receipt=${receipt?.selectedLane?.id ?? "missing"}`,
    "Rebuild the dispatch packet, send bundle, contact readiness, execution brief, and receipt template from one selected lane."
  );

  push(
    checks,
    "Live preflight is passed and newer than the send bundle",
    preflight?.responseMode === "public_beta_tester_session_preflight_json_v1" &&
      preflight.status === "passed" &&
      preflight.canInviteTester === true &&
      preflight.passed === preflight.total &&
      preflightFresh,
    `preflight=${statusLine(preflight)} generated=${preflight?.generatedAt ?? "missing"}; bundleGenerated=${sendBundle?.generatedAt ?? "missing"}; fresh=${preflightFresh}`,
    "Run npm run preflight:public-beta-tester, rebuild contact readiness, then rebuild this final go/no-go gate immediately before contact."
  );

  push(
    checks,
    "Contact and manual send are allowed but still unsent",
    contact?.status === "ready_to_contact_first_external_person" &&
      contact.contactAllowed === true &&
      contact.contactDecision === "may_contact_exactly_one_person" &&
      contact.actualSendPerformed === false &&
      brief?.status === "ready_for_manual_send_execution" &&
      brief.manualSendAllowed === true &&
      brief.actualSendPerformed === false &&
      sendBundle?.actualSendPerformed === false,
    `contact=${contact?.status ?? "missing"} allowed=${contact?.contactAllowed ?? "missing"}; brief=${brief?.status ?? "missing"} manual=${brief?.manualSendAllowed ?? "missing"}; actualSend=${brief?.actualSendPerformed ?? "missing"}`,
    "Do not contact anyone until contact readiness and send execution brief are both green and unsent."
  );

  push(
    checks,
    "Only the declared external send folder can leave the workspace",
    sendBundle?.externalSendFolder === "artifacts/productization/first-real-tester-send-bundle/SEND_TO_FIRST_EXTERNAL_PERSON" &&
      contact?.sendBoundary?.externalSendFolder === sendBundle.externalSendFolder &&
      brief?.outboundScope?.externalSendFolder === sendBundle.externalSendFolder &&
      brief.outboundScope.exactlyOneExternalPerson === true &&
      briefFiles.length >= 3 &&
      briefFiles.every((file) => (file.bundlePath ?? "").startsWith("SEND_TO_FIRST_EXTERNAL_PERSON/") && shaLooksValid(file.expectedSha256)),
    `folder=${sendBundle?.externalSendFolder ?? "missing"}; files=${briefFiles.map((file) => file.bundlePath ?? "missing").join(",") || "none"}`,
    "Send only artifacts/productization/first-real-tester-send-bundle/SEND_TO_FIRST_EXTERNAL_PERSON to exactly one external person."
  );

  push(
    checks,
    "Manual send receipt is still a not-sent template with SHA-bound materials",
    receipt?.status === "template_ready" &&
      receipt.defaultDecision === "not_sent_yet" &&
      receipt.sourceBundle?.actualSendPerformed === false &&
      sentMaterials.length === briefFiles.length &&
      sentMaterials.every((file) => file.sent === false && shaLooksValid(file.expectedSha256)) &&
      negativeAssertionValues.length >= 6 &&
      negativeAssertionValues.every((value) => value === false) &&
      receipt.validationFailureHandoff?.failedChecksField === "failedChecks" &&
      receipt.validationFailureHandoff.remediationActionsField === "remediationActions" &&
      receipt.validationFailureHandoff.nextActionField === "nextAction",
    `receipt=${receipt?.status ?? "missing"} decision=${receipt?.defaultDecision ?? "missing"}; sentDefaults=${sentMaterials.map((file) => `${file.bundlePath}:${file.sent}`).join(",") || "none"}`,
    "After manual send, fill a copy of the receipt, set the material confirmations, and validate it before waiting for a return."
  );

  push(
    checks,
    "Return processing remains gated on the validated manual-send receipt",
    workbench?.status === "ready_to_process_exactly_one_first_return" &&
      workbench.sendReceiptHandoff?.requiredBeforeReturnIntake === true &&
      workbench.sendReceiptHandoff.validationEvidencePath === "artifacts/productization/first-real-tester-send-receipt-validation.json" &&
      workbench.sendReceiptHandoff.sendBundleFingerprintGate === "sha256-bound" &&
      workbench.operatorRule?.verifyManualSendReceiptBeforeReturnIntake === true &&
      returnGate?.status === "waiting_for_first_return" &&
      returnGate.returnState?.canInviteAdditionalTesterOrReviewer === false,
    `workbench=${workbench?.status ?? "missing"}; validation=${workbench?.sendReceiptHandoff?.validationEvidencePath ?? "missing"}; returnGate=${returnGate?.status ?? "missing"} canInvite=${returnGate?.returnState?.canInviteAdditionalTesterOrReviewer ?? "missing"}`,
    "Stop before lane intake unless the filled manual-send receipt validates the sent materials and negative assertions."
  );

  push(
    checks,
    "Blocked transitions still prevent release, model activation, and widening",
    (brief?.blockedActions ?? []).includes("send_more_than_one_person") &&
      (brief?.blockedActions ?? []).includes("send_release_approval_or_real_model_materials") &&
      (brief?.blockedActions ?? []).includes("claim_acceptance_from_manual_send") &&
      (brief?.blockedActions ?? []).includes("invite_second_person_before_return_gate"),
    `blocked=${brief?.blockedActions?.join(",") ?? "missing"}`,
    "Do not use this go/no-go gate as acceptance, release approval, real-model activation, or permission to invite a second person."
  );

  const failedRequiredChecks = checks.filter((check) => check.requiredForGo && !check.pass).map((check) => check.name);
  const status = failedRequiredChecks.length === 0 ? "ready_for_one_manual_send" : "blocked_before_manual_send";
  const goNoGo = {
    responseMode: "first_real_tester_final_go_no_go_json_v1",
    status,
    generatedAt: new Date().toISOString(),
    command: "npm run build:first-real-tester-final-go-no-go",
    productScope: "bounded_core_teaching_loop",
    allSoftwareObjective: "paused",
    releaseDecision: "do_not_release",
    reviewOnly: true,
    accepted: false,
    packagingGated: true,
    canRelease: false,
    canActivateRealModel: false,
    selectedLane,
    manualSendAllowed: status === "ready_for_one_manual_send",
    actualSendPerformed: false,
    externalSendFolder: sendBundle?.externalSendFolder ?? "missing",
    validationEvidencePath: "artifacts/productization/first-real-tester-send-receipt-validation.json",
    returnGatePath: "artifacts/productization/first-real-tester-return-gate.md",
    checks,
    failedRequiredChecks,
    operatorFinalAssertions: [
      "Run this final go/no-go gate immediately before the manual send.",
      "Send exactly artifacts/productization/first-real-tester-send-bundle/SEND_TO_FIRST_EXTERNAL_PERSON to one external person.",
      "Do not send KEEP_FOR_RETURN_INTAKE, maintainer notes, release approval, real-model trial, or unselected lane materials.",
      "After sending, fill a copy of first-real-tester-send-receipt.template.json and validate it.",
      "Do not invite anyone else until first-real-tester-return-gate allows widening after the first return."
    ],
    nextAction:
      status === "ready_for_one_manual_send"
        ? "Manually send exactly the external send folder to one external person, then validate a filled send receipt before waiting for the first return."
        : `Stop before contact. Fix failed checks: ${failedRequiredChecks.join(", ") || "unknown"}.`
  };

  fs.mkdirSync(artifactsDir, { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(goNoGo, null, 2)}\n`, "utf8");

  const markdown = `# First Real Tester Final Go/No-Go

Status: \`${goNoGo.status}\`

Manual send allowed: \`${goNoGo.manualSendAllowed}\`
Actual send performed: \`${goNoGo.actualSendPerformed}\`
Selected lane: \`${goNoGo.selectedLane}\`
Release decision: \`${goNoGo.releaseDecision}\`
Accepted: \`${goNoGo.accepted}\`
Packaging gated: \`${goNoGo.packagingGated}\`
Can release: \`${goNoGo.canRelease}\`
Can activate real model: \`${goNoGo.canActivateRealModel}\`

## Send Exactly One Folder

- External send folder: \`${goNoGo.externalSendFolder}\`
- Validation evidence after manual send: \`${goNoGo.validationEvidencePath}\`
- Return gate: \`${goNoGo.returnGatePath}\`

## Required Checks

${markdownList(checks.map((check) => `\`${check.pass}\` - ${check.name}: ${check.evidence}`))}

## Operator Final Assertions

${markdownList(goNoGo.operatorFinalAssertions)}

## Next Action

${goNoGo.nextAction}
`;
  fs.writeFileSync(markdownPath, markdown, "utf8");

  console.log(JSON.stringify(goNoGo, null, 2));
  console.log(`\nFirst real tester final go/no-go written to ${outputPath}`);
  console.log(`First real tester final go/no-go Markdown written to ${markdownPath}`);
}

main();
