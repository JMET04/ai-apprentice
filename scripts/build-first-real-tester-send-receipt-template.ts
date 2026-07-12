import fs from "node:fs";
import path from "node:path";

type SendBundle = {
  responseMode?: string;
  status?: string;
  productScope?: string;
  allSoftwareObjective?: string;
  releaseDecision?: string;
  reviewOnly?: boolean;
  accepted?: boolean;
  packagingGated?: boolean;
  canRelease?: boolean;
  canActivateRealModel?: boolean;
  actualSendPerformed?: boolean;
  selectedLane?: { id?: string; title?: string; preflightCommand?: string; preflightEvidencePath?: string };
  externalSendFolder?: string;
  returnIntakeFolder?: string;
  sendFiles?: Array<{ id?: string; bundlePath?: string; bytes?: number; sha256?: string; audience?: string }>;
  returnFiles?: Array<{ id?: string; bundlePath?: string; bytes?: number; sha256?: string; audience?: string }>;
  excludedLaneIds?: string[];
  blockedActions?: string[];
};

const rootDir = process.cwd();
const artifactsDir = path.join(rootDir, "artifacts", "productization");
const bundlePath = path.join(artifactsDir, "first-real-tester-send-bundle.json");
const templatePath = path.join(artifactsDir, "first-real-tester-send-receipt.template.json");
const markdownPath = path.join(artifactsDir, "first-real-tester-send-receipt-template.md");

function readJson<T>(targetPath: string): T | null {
  try {
    return JSON.parse(fs.readFileSync(targetPath, "utf8")) as T;
  } catch {
    return null;
  }
}

function statusLine(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : "missing";
}

function markdownList(items: string[]) {
  return items.map((item) => `- ${item}`).join("\n");
}

function buildTemplate() {
  const bundle = readJson<SendBundle>(bundlePath);
  const failedReasons: string[] = [];

  if (bundle?.responseMode !== "first_real_tester_send_bundle_json_v1") failedReasons.push("send_bundle_missing");
  if (bundle?.status !== "ready_to_send_chosen_lane") failedReasons.push("send_bundle_not_ready");
  if (bundle?.productScope !== "bounded_core_teaching_loop") failedReasons.push("unexpected_product_scope");
  if (bundle?.allSoftwareObjective !== "paused") failedReasons.push("all_software_not_paused");
  if (bundle?.releaseDecision !== "do_not_release") failedReasons.push("release_not_locked");
  if (bundle?.accepted !== false || bundle?.packagingGated !== true || bundle?.canRelease !== false || bundle?.canActivateRealModel !== false) {
    failedReasons.push("productization_locks_not_preserved");
  }
  if (bundle?.actualSendPerformed !== false) failedReasons.push("send_bundle_must_not_claim_already_sent");
  if (!bundle?.selectedLane?.id) failedReasons.push("selected_lane_missing");
  if ((bundle?.sendFiles?.length ?? 0) === 0) failedReasons.push("send_files_missing");
  if ((bundle?.returnFiles?.length ?? 0) === 0) failedReasons.push("return_files_missing");

  const template = {
    responseMode: "first_real_tester_send_receipt_template_json_v1",
    status: failedReasons.length === 0 ? "template_ready" : "blocked_before_template",
    generatedAt: new Date().toISOString(),
    command: "npm run build:first-real-tester-send-receipt-template",
    productScope: "bounded_core_teaching_loop",
    allSoftwareObjective: "paused",
    releaseDecision: "do_not_release",
    reviewOnly: true,
    accepted: false,
    packagingGated: true,
    canRelease: false,
    canActivateRealModel: false,
    defaultDecision: "not_sent_yet",
    allowedDecisions: ["not_sent_yet", "preflight_ready", "sent_manually"],
    blockedDecisions: ["accepted", "release_approved", "packaging_unlocked", "real_model_accepted", "all_software_resumed"],
    selectedLane: {
      id: statusLine(bundle?.selectedLane?.id),
      title: statusLine(bundle?.selectedLane?.title),
      preflightCommand: statusLine(bundle?.selectedLane?.preflightCommand),
      preflightEvidencePath: statusLine(bundle?.selectedLane?.preflightEvidencePath)
    },
    sourceBundle: {
      manifestPath: "artifacts/productization/first-real-tester-send-bundle.json",
      externalSendFolder: statusLine(bundle?.externalSendFolder),
      returnIntakeFolder: statusLine(bundle?.returnIntakeFolder),
      actualSendPerformed: bundle?.actualSendPerformed === true
    },
    receiptFields: {
      decision: "not_sent_yet",
      maintainerNameOrRole: "",
      firstExternalPersonRole: "",
      contactChannel: "",
      sendTimestampIso: "",
      preflight: {
        commandRun: false,
        baseUrl: "",
        evidencePath: statusLine(bundle?.selectedLane?.preflightEvidencePath),
        resultStatus: "not_run_yet"
      },
      sentMaterials: (bundle?.sendFiles ?? []).map((file) => ({
        id: file.id ?? "missing",
        bundlePath: file.bundlePath ?? "missing",
        audience: file.audience ?? "missing",
        expectedBytes: file.bytes ?? 0,
        expectedSha256: file.sha256 ?? "missing",
        sent: false
      })),
      retainedByMaintainer: (bundle?.returnFiles ?? []).map((file) => ({
        id: file.id ?? "missing",
        bundlePath: file.bundlePath ?? "missing",
        audience: file.audience ?? "missing",
        expectedBytes: file.bytes ?? 0,
        expectedSha256: file.sha256 ?? "missing",
        retained: true
      })),
      negativeAssertions: {
        sentOnlyExternalFolder: false,
        didNotSendReturnIntakeFolder: false,
        didNotSendMaintainerReadme: false,
        didNotSendUnselectedLaneMaterials: false,
        didNotSendReleaseApprovalMaterials: false,
        didNotSendRealModelTrialMaterials: false,
        didNotClaimAcceptance: false,
        didNotInviteAdditionalTesterOrReviewer: false
      },
      followUp: {
        nextExpectedStep: "wait_for_first_return_then_use_return_workbench",
        returnWorkbenchPath: "artifacts/productization/first-real-tester-return-workbench.md",
        returnGatePath: "artifacts/productization/first-real-tester-return-gate.md"
      }
    },
    validationRules: {
      sentManuallyRequiresPreflightRun: true,
      sentManuallyRequiresEverySentMaterialMarkedSent: true,
      sentManuallyRequiresEveryNegativeAssertionTrue: true,
      sentManuallyDoesNotSetAcceptedOrRelease: true,
      sentManuallyDoesNotUnlockPackagingOrRealModel: true
    },
    blockedActions: [
      ...(bundle?.blockedActions ?? []),
      "record_acceptance_from_send_receipt",
      "record_release_approval_from_send_receipt",
      "unlock_packaging_from_send_receipt",
      "activate_real_model_from_send_receipt",
      "invite_second_external_person_from_send_receipt"
    ],
    validationFailureHandoff: {
      failedChecksField: "failedChecks",
      remediationActionsField: "remediationActions",
      nextActionField: "nextAction",
      rule: "If validation fails, read failedChecks for evidence and follow remediationActions in order before treating the manual send as recorded."
    },
    failedReasons,
    nextAction:
      failedReasons.length === 0
        ? "Fill a copy only after preflight succeeds and the maintainer manually sends exactly SEND_TO_FIRST_EXTERNAL_PERSON. Then run npm run verify:first-real-tester-send-receipt-template -- --receipt <path>; if validation fails, read failedChecks and follow remediationActions before treating the send as recorded."
        : "Fix send bundle readiness before using the first real tester send receipt template."
  };

  const markdown = `# First Real Tester Send Receipt Template\n\nStatus: \`${template.status}\`\n\nSelected lane: \`${template.selectedLane.id}\`\n\nDefault decision: \`${template.defaultDecision}\`\n\nThis template records the manual send event only. Validate a filled copy with \`npm run verify:first-real-tester-send-receipt-template -- --receipt <path>\`. If validation fails, inspect \`failedChecks\` for the evidence and follow \`remediationActions\` in order before treating the manual send as recorded. It is not acceptance, release approval, packaging unlock, real-model acceptance, or permission to invite another tester.\n\n## Source Bundle\n\n- Manifest: \`${template.sourceBundle.manifestPath}\`\n- External send folder: \`${template.sourceBundle.externalSendFolder}\`\n- Return intake folder: \`${template.sourceBundle.returnIntakeFolder}\`\n- Source bundle claims actual send performed: \`${template.sourceBundle.actualSendPerformed}\`\n\n## Preflight\n\n- Command: \`${template.selectedLane.preflightCommand}\`\n- Evidence path: \`${template.selectedLane.preflightEvidencePath}\`\n\n## Allowed Decisions\n\n${markdownList(template.allowedDecisions.map((decision) => `\`${decision}\``))}\n\n## Blocked Decisions\n\n${markdownList(template.blockedDecisions.map((decision) => `\`${decision}\``))}\n\n## Sent Materials To Confirm\n\n${markdownList(template.receiptFields.sentMaterials.map((file) => `\`${file.bundlePath}\` expected sha256=\`${file.expectedSha256}\` default sent=\`${file.sent}\``))}\n\n## Retained Materials\n\n${markdownList(template.receiptFields.retainedByMaintainer.map((file) => `\`${file.bundlePath}\` expected sha256=\`${file.expectedSha256}\` default retained=\`${file.retained}\``))}\n\n## Required Negative Assertions For Sent Manually\n\n${markdownList(Object.keys(template.receiptFields.negativeAssertions).map((key) => `\`${key}\``))}\n\n## Validation Failure Handoff\n\n- Failed checks field: \`${template.validationFailureHandoff.failedChecksField}\`\n- Remediation actions field: \`${template.validationFailureHandoff.remediationActionsField}\`\n- Next action field: \`${template.validationFailureHandoff.nextActionField}\`\n- Rule: ${template.validationFailureHandoff.rule}\n\n## Boundary\n\n- Release decision: \`${template.releaseDecision}\`\n- Accepted: \`${template.accepted}\`\n- Packaging gated: \`${template.packagingGated}\`\n- Can release: \`${template.canRelease}\`\n- Can activate real model: \`${template.canActivateRealModel}\`\n\n## Next Action\n\n${template.nextAction}\n`;

  fs.writeFileSync(templatePath, `${JSON.stringify(template, null, 2)}\n`, "utf8");
  fs.writeFileSync(markdownPath, markdown, "utf8");
  console.log(JSON.stringify(template, null, 2));
  console.log(`\nFirst real tester send receipt template written to ${templatePath}`);
  if (template.status !== "template_ready") process.exitCode = 1;
}

try {
  buildTemplate();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}

export {};
