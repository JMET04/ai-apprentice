import fs from "node:fs";
import path from "node:path";

const rootDir = process.cwd();
const artifactsDir = path.join(rootDir, "artifacts", "productization");
const briefPath = path.join(artifactsDir, "first-real-tester-send-execution-brief.json");
const briefMarkdownPath = path.join(artifactsDir, "first-real-tester-send-execution-brief.md");

type Check = { name: string; pass: boolean; evidence: string; requiredForManualSend: boolean; nextAction?: string };

type ContactReadiness = {
  responseMode?: string;
  status?: string;
  generatedAt?: string;
  releaseDecision?: string;
  accepted?: boolean;
  packagingGated?: boolean;
  canRelease?: boolean;
  canActivateRealModel?: boolean;
  allSoftwareObjective?: string;
  contactAllowed?: boolean;
  actualSendPerformed?: boolean;
  contactDecision?: string;
  selectedLane?: { id?: string; preflightCommand?: string; preflightEvidencePath?: string };
  sendBoundary?: { externalSendFolder?: string; returnIntakeFolder?: string; sendReceiptTemplatePath?: string; validationCommandAfterManualSend?: string; validationEvidencePath?: string };
};

type SendBundle = {
  responseMode?: string;
  status?: string;
  generatedAt?: string;
  releaseDecision?: string;
  accepted?: boolean;
  packagingGated?: boolean;
  canRelease?: boolean;
  canActivateRealModel?: boolean;
  allSoftwareObjective?: string;
  actualSendPerformed?: boolean;
  selectedLane?: { id?: string };
  externalSendFolder?: string;
  returnIntakeFolder?: string;
  sendFiles?: Array<{ bundlePath?: string; bytes?: number; sha256?: string }>;
};

type SendReceiptTemplate = {
  responseMode?: string;
  status?: string;
  defaultDecision?: string;
  sourceBundle?: { actualSendPerformed?: boolean; externalSendFolder?: string };
  receiptFields?: { sentMaterials?: Array<{ bundlePath?: string; expectedBytes?: number; expectedSha256?: string; sent?: boolean }>; negativeAssertions?: Record<string, boolean> };
  releaseDecision?: string;
  accepted?: boolean;
  packagingGated?: boolean;
  canRelease?: boolean;
  canActivateRealModel?: boolean;
};

type PreflightReceipt = { responseMode?: string; status?: string; generatedAt?: string; baseUrl?: string; canInviteTester?: boolean; passed?: number; total?: number; releaseDecision?: string; accepted?: boolean; packagingGated?: boolean };

function readJson<T>(relativePath: string): T | null {
  try {
    return JSON.parse(fs.readFileSync(path.join(rootDir, relativePath), "utf8")) as T;
  } catch {
    return null;
  }
}

function fileExists(relativePath: string, minBytes = 1) {
  const fullPath = path.join(rootDir, relativePath);
  return fs.existsSync(fullPath) && fs.statSync(fullPath).size >= minBytes;
}

function shaLooksValid(value: string | undefined) {
  return /^[a-f0-9]{64}$/.test(value ?? "");
}

function push(checks: Check[], name: string, pass: boolean, evidence: string, requiredForManualSend = true, nextAction?: string) {
  checks.push({ name, pass, evidence, requiredForManualSend, nextAction });
}

function markdownList(items: string[]) {
  return items.map((item) => `- ${item}`).join("\n");
}

function main() {
  const contact = readJson<ContactReadiness>("artifacts/productization/first-real-tester-contact-readiness.json");
  const bundle = readJson<SendBundle>("artifacts/productization/first-real-tester-send-bundle.json");
  const receipt = readJson<SendReceiptTemplate>("artifacts/productization/first-real-tester-send-receipt.template.json");
  const preflightPath =
    contact?.selectedLane?.preflightEvidencePath ?? "artifacts/productization/public-beta-tester-session-preflight.json";
  const preflight = readJson<PreflightReceipt>(preflightPath);
  const checks: Check[] = [];

  const sendFiles = bundle?.sendFiles ?? [];
  const externalSendFolder = "artifacts/productization/first-real-tester-send-bundle/SEND_TO_FIRST_EXTERNAL_PERSON";
  const expectedSent = receipt?.receiptFields?.sentMaterials ?? [];

  push(
    checks,
    "Contact readiness allows exactly one external contact",
    contact?.responseMode === "first_real_tester_contact_readiness_json_v1" &&
      contact.status === "ready_to_contact_first_external_person" &&
      contact.contactAllowed === true &&
      contact.contactDecision === "may_contact_exactly_one_person" &&
      contact.actualSendPerformed === false,
    `status=${contact?.status ?? "missing"}; contactAllowed=${contact?.contactAllowed ?? "missing"}; decision=${contact?.contactDecision ?? "missing"}; sent=${contact?.actualSendPerformed ?? "missing"}`,
    true,
    "Run npm run preflight:public-beta-tester, npm run build:first-real-tester-contact-readiness, and npm run verify:first-real-tester-contact-readiness."
  );

  push(
    checks,
    "External send folder is the only allowed outbound folder",
    bundle?.status === "ready_to_send_chosen_lane" &&
      bundle.externalSendFolder === externalSendFolder &&
      contact?.sendBoundary?.externalSendFolder === externalSendFolder &&
      sendFiles.length >= 3 &&
      sendFiles.every((file) => typeof file.bundlePath === "string" && file.bundlePath.startsWith("SEND_TO_FIRST_EXTERNAL_PERSON/") && shaLooksValid(file.sha256) && fileExists(path.join("artifacts/productization/first-real-tester-send-bundle", file.bundlePath), 1)),
    `folder=${bundle?.externalSendFolder ?? "missing"}; files=${sendFiles.map((file) => file.bundlePath ?? "missing").join(",") || "none"}`,
    true,
    "Send only artifacts/productization/first-real-tester-send-bundle/SEND_TO_FIRST_EXTERNAL_PERSON."
  );

  push(
    checks,
    "Manual send receipt template is ready and unsent",
    receipt?.status === "template_ready" &&
      receipt.defaultDecision === "not_sent_yet" &&
      receipt.sourceBundle?.actualSendPerformed === false &&
      expectedSent.length === sendFiles.length &&
      expectedSent.every((item) => item.sent === false && shaLooksValid(item.expectedSha256)),
    `template=${receipt?.status ?? "missing"}; decision=${receipt?.defaultDecision ?? "missing"}; sourceSent=${receipt?.sourceBundle?.actualSendPerformed ?? "missing"}; expected=${expectedSent.length}`,
    true,
    "After manual send, fill a copy and run npm run verify:first-real-tester-send-receipt-template -- --receipt <path>."
  );

  push(
    checks,
    "Live preflight remains current for the selected lane",
    preflight?.responseMode === "public_beta_tester_session_preflight_json_v1" &&
      preflight.status === "passed" &&
      preflight.canInviteTester === true &&
      preflight.releaseDecision === "do_not_release" &&
      preflight.accepted === false &&
      preflight.packagingGated === true &&
      typeof preflight.generatedAt === "string" &&
      typeof bundle?.generatedAt === "string" &&
      Date.parse(preflight.generatedAt) >= Date.parse(bundle.generatedAt),
    `preflight=${preflight?.status ?? "missing"}; generated=${preflight?.generatedAt ?? "missing"}; bundle=${bundle?.generatedAt ?? "missing"}; checks=${preflight?.passed ?? "?"}/${preflight?.total ?? "?"}`,
    true,
    "Refresh preflight immediately before sending if this evidence becomes stale."
  );

  push(
    checks,
    "Manual send execution cannot unlock release, packaging, real-model, or all-software scope",
    contact?.releaseDecision === "do_not_release" &&
      contact.accepted === false &&
      contact.packagingGated === true &&
      contact.canRelease === false &&
      contact.canActivateRealModel === false &&
      contact.allSoftwareObjective === "paused" &&
      bundle?.releaseDecision === "do_not_release" &&
      receipt?.releaseDecision === "do_not_release",
    `contactRelease=${contact?.releaseDecision ?? "missing"}; accepted=${contact?.accepted ?? "missing"}; packaging=${contact?.packagingGated ?? "missing"}; model=${contact?.canActivateRealModel ?? "missing"}; allSoftware=${contact?.allSoftwareObjective ?? "missing"}`,
    true,
    "Stop if any send evidence claims acceptance, release, packaging unlock, real-model activation, or all-software scope."
  );

  const requiredChecks = checks.filter((check) => check.requiredForManualSend);
  const failedRequiredChecks = requiredChecks.filter((check) => !check.pass).map((check) => check.name);
  const status = failedRequiredChecks.length === 0 ? "ready_for_manual_send_execution" : "blocked_before_manual_send_execution";
  const manualSendAllowed = status === "ready_for_manual_send_execution";

  const brief = {
    responseMode: "first_real_tester_send_execution_brief_json_v1",
    status,
    generatedAt: new Date().toISOString(),
    command: "npm run build:first-real-tester-send-execution-brief",
    productScope: "bounded_core_teaching_loop",
    allSoftwareObjective: "paused",
    releaseDecision: "do_not_release",
    reviewOnly: true,
    accepted: false,
    packagingGated: true,
    canRelease: false,
    canActivateRealModel: false,
    manualSendAllowed,
    actualSendPerformed: false,
    selectedLane: {
      id: bundle?.selectedLane?.id ?? contact?.selectedLane?.id ?? "missing",
      preflightEvidencePath: contact?.selectedLane?.preflightEvidencePath ?? "artifacts/productization/public-beta-tester-session-preflight.json"
    },
    outboundScope: {
      exactlyOneExternalPerson: true,
      externalSendFolder,
      forbiddenFolders: [
        "artifacts/productization/first-real-tester-send-bundle/KEEP_FOR_RETURN_INTAKE",
        "artifacts/productization/first-real-tester-send-bundle/MAINTAINER_README_DO_NOT_SEND.md",
        "artifacts/productization/public-beta-packet/docs",
        "artifacts/productization/real-model-trial-kit.md",
        "artifacts/productization/product-release-approval.template.json"
      ],
      sendFiles: sendFiles.map((file) => ({ bundlePath: file.bundlePath, expectedBytes: file.bytes, expectedSha256: file.sha256 }))
    },
    operatorFillAfterManualSend: {
      receiptTemplatePath: "artifacts/productization/first-real-tester-send-receipt.template.json",
      receiptMarkdownPath: "artifacts/productization/first-real-tester-send-receipt-template.md",
      receiptFieldsToFill: [
        "receiptFields.decision=sent_manually",
        "receiptFields.maintainerNameOrRole",
        "receiptFields.firstExternalPersonRole",
        "receiptFields.contactChannel",
        "receiptFields.sendTimestampIso",
        "receiptFields.preflight.commandRun=true",
        "receiptFields.preflight.resultStatus=passed",
        "receiptFields.preflight.evidencePath=artifacts/productization/public-beta-tester-session-preflight.json"
      ],
      materialConfirmations: [
        "Set every receiptFields.sentMaterials[].sent=true for the three files actually sent from SEND_TO_FIRST_EXTERNAL_PERSON.",
        "Keep every receiptFields.retainedByMaintainer[].retained=true and do not send retained materials externally."
      ],
      negativeAssertionsToConfirm: Object.keys(receipt?.receiptFields?.negativeAssertions ?? {}),
      validationCommand: "npm run verify:first-real-tester-send-receipt-template -- --receipt <path>",
      validationEvidencePath: "artifacts/productization/first-real-tester-send-receipt-validation.json",
      validationFailureFields: ["failedChecks", "remediationActions", "nextAction"]
    },
    blockedActions: [
      "send_more_than_one_person",
      "send_keep_for_return_intake_folder",
      "send_maintainer_readme",
      "send_release_approval_or_real_model_materials",
      "claim_acceptance_from_manual_send",
      "invite_second_person_before_return_gate"
    ],
    checks,
    failedRequiredChecks,
    nextAction: manualSendAllowed
      ? "Manually send exactly SEND_TO_FIRST_EXTERNAL_PERSON to one external person, fill a copy of the send receipt, validate it, and follow remediationActions if validation fails before waiting for the first return."
      : "Fix failed manual-send checks, rebuild contact readiness, then rebuild this execution brief."
  };

  fs.mkdirSync(artifactsDir, { recursive: true });
  fs.writeFileSync(briefPath, `${JSON.stringify(brief, null, 2)}\n`, "utf8");

  const markdown = `# First Real Tester Send Execution Brief\n\nStatus: \`${brief.status}\`\n\nManual send allowed: \`${brief.manualSendAllowed}\`\nActual send performed: \`${brief.actualSendPerformed}\`\nRelease decision: \`${brief.releaseDecision}\`\nAccepted: \`${brief.accepted}\`\nPackaging gated: \`${brief.packagingGated}\`\nCan release: \`${brief.canRelease}\`\nCan activate real model: \`${brief.canActivateRealModel}\`\nAll-software objective: \`${brief.allSoftwareObjective}\`\n\n## Send Only\n\n- External folder: \`${brief.outboundScope.externalSendFolder}\`\n- Exactly one external person: \`${brief.outboundScope.exactlyOneExternalPerson}\`\n\n## Files\n\n${markdownList(brief.outboundScope.sendFiles.map((file) => `\`${file.bundlePath}\` expected sha256=\`${file.expectedSha256}\` bytes=\`${file.expectedBytes}\``))}\n\n## Do Not Send\n\n${markdownList(brief.outboundScope.forbiddenFolders.map((item) => `\`${item}\``))}\n\n## Required Checks\n\n${markdownList(checks.map((check) => `\`${check.pass}\` - ${check.name}: ${check.evidence}`))}\n\n## After Manual Send\n\n- In a copy of \`${brief.operatorFillAfterManualSend.receiptTemplatePath}\`, set these fields: \`${brief.operatorFillAfterManualSend.receiptFieldsToFill.join("\`, \`")}\`.\n- Mark the sent material confirmations and negative assertions before validation: \`${brief.operatorFillAfterManualSend.materialConfirmations.join("\`; \`")}\`; \`${brief.operatorFillAfterManualSend.negativeAssertionsToConfirm.join("\`, \`")}\`.\n- Validate it with \`${brief.operatorFillAfterManualSend.validationCommand}\`.\n- If validation fails, inspect \`${brief.operatorFillAfterManualSend.validationFailureFields.join("\`, \`")}\` and follow \`remediationActions\` before treating the manual send as recorded.\n- Keep validation evidence at \`${brief.operatorFillAfterManualSend.validationEvidencePath}\`.\n\n## Blocked Actions\n\n${markdownList(brief.blockedActions.map((item) => `\`${item}\``))}\n\n## Next Action\n\n${brief.nextAction}\n`;
  fs.writeFileSync(briefMarkdownPath, markdown, "utf8");

  console.log(JSON.stringify(brief, null, 2));
  console.log(`\nFirst real tester send execution brief written to ${briefPath}`);
}

main();
