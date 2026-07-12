import fs from "node:fs";
import path from "node:path";

type JsonRecord = Record<string, any>;

const artifactsDir = path.join(process.cwd(), "artifacts", "productization");
const workbenchJsonPath = path.join(artifactsDir, "first-real-tester-return-workbench.json");
const workbenchMarkdownPath = path.join(artifactsDir, "first-real-tester-return-workbench.md");

function readJson<T = JsonRecord>(relativePath: string): T | null {
  try {
    return JSON.parse(fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")) as T;
  } catch {
    return null;
  }
}

function statusLine(status: string | undefined, passed?: number, total?: number): string {
  if (!status) return "missing";
  if (typeof passed === "number" && typeof total === "number") return `${status} ${passed}/${total}`;
  return status;
}

function markdownList(items: string[]): string {
  return items.map((item) => `- ${item}`).join("\n");
}

function buildFirstRealTesterReturnWorkbench() {
  const launch = readJson<{ status?: string; readyToLaunch?: boolean }>(
    "artifacts/productization/first-real-tester-launch.json"
  );
  const launchVerification = readJson<{ status?: string; passed?: number; total?: number }>(
    "artifacts/productization/first-real-tester-launch-verification.json"
  );
  const betaReturnVerification = readJson<{ status?: string; passed?: number; total?: number }>(
    "artifacts/productization/public-beta-return-intake-verification.json"
  );
  const humanReturnVerification = readJson<{ status?: string; passed?: number; total?: number }>(
    "artifacts/productization/human-acceptance-return-intake-verification.json"
  );
  const betaSessionReceiptValidation = readJson<{ status?: string; passed?: number; total?: number }>(
    "artifacts/productization/public-beta-session-receipt-validation.json"
  );
  const humanReceiptValidation = readJson<{ status?: string; passed?: number; total?: number }>(
    "artifacts/productization/human-acceptance-receipt-validation.json"
  );
  const sendBundle = readJson<{ status?: string; selectedLane?: { id?: string }; actualSendPerformed?: boolean }>(
    "artifacts/productization/first-real-tester-send-bundle.json"
  );
  const sendBundleVerification = readJson<{
    status?: string;
    passed?: number;
    total?: number;
    checks?: Array<{ name?: string; pass?: boolean }>;
  }>("artifacts/productization/first-real-tester-send-bundle-verification.json");
  const sendReceiptTemplateVerification = readJson<{
    status?: string;
    passed?: number;
    total?: number;
    decision?: string;
  }>("artifacts/productization/first-real-tester-send-receipt-template-verification.json");
  const submittedSendReceiptValidation = readJson<{
    status?: string;
    passed?: number;
    total?: number;
    decision?: string;
    inputPath?: string;
  }>("artifacts/productization/first-real-tester-send-receipt-validation.json");
  const sendBundleFingerprintGate =
    sendBundleVerification?.checks?.some(
      (check) => check.name === "Declared send bundle fingerprints match disk files" && check.pass === true
    ) === true
      ? "sha256-bound"
      : "missing";
  const submittedSendReceiptStatus = submittedSendReceiptValidation
    ? `${statusLine(
        submittedSendReceiptValidation.status,
        submittedSendReceiptValidation.passed,
        submittedSendReceiptValidation.total
      )}; decision=${submittedSendReceiptValidation.decision ?? "missing"}; input=${
        submittedSendReceiptValidation.inputPath ?? "missing"
      }`
    : "not_submitted_yet; required_before_processing_return_after_manual_send";

  const workbench = {
    responseMode: "first_real_tester_return_workbench_json_v1",
    status: "ready_to_process_exactly_one_first_return",
    generatedAt: new Date().toISOString(),
    command: "npm run build:first-real-tester-return-workbench",
    productScope: "bounded_core_teaching_loop",
    allSoftwareObjective: "paused",
    releaseDecision: "do_not_release",
    reviewOnly: true,
    accepted: false,
    packagingGated: true,
    canRelease: false,
    canActivateRealModel: false,
    sourceEvidence: {
      firstRealTesterLaunch: `${launch?.status ?? "missing"}; ready=${launch?.readyToLaunch ?? false}; verifier=${statusLine(
        launchVerification?.status,
        launchVerification?.passed,
        launchVerification?.total
      )}`,
      publicBetaReturnIntakeVerifier: statusLine(
        betaReturnVerification?.status,
        betaReturnVerification?.passed,
        betaReturnVerification?.total
      ),
      publicBetaSessionReceiptTemplate: statusLine(
        betaSessionReceiptValidation?.status,
        betaSessionReceiptValidation?.passed,
        betaSessionReceiptValidation?.total
      ),
      humanAcceptanceReturnIntakeVerifier: statusLine(
        humanReturnVerification?.status,
        humanReturnVerification?.passed,
        humanReturnVerification?.total
      ),
      humanAcceptanceReceiptTemplate: statusLine(
        humanReceiptValidation?.status,
        humanReceiptValidation?.passed,
        humanReceiptValidation?.total
      ),
      firstRealTesterSendBundle: `${sendBundle?.status ?? "missing"}; lane=${
        sendBundle?.selectedLane?.id ?? "missing"
      }; actualSendPerformed=${sendBundle?.actualSendPerformed ?? "missing"}; verifier=${statusLine(
        sendBundleVerification?.status,
        sendBundleVerification?.passed,
        sendBundleVerification?.total
      )}; fingerprint=${sendBundleFingerprintGate}`,
      firstRealTesterSendReceiptTemplate: `${statusLine(
        sendReceiptTemplateVerification?.status,
        sendReceiptTemplateVerification?.passed,
        sendReceiptTemplateVerification?.total
      )}; decision=${sendReceiptTemplateVerification?.decision ?? "missing"}`,
      firstRealTesterSubmittedSendReceipt: submittedSendReceiptStatus
    },
    sendReceiptHandoff: {
      requiredBeforeReturnIntake: true,
      selectedLane: sendBundle?.selectedLane?.id ?? "missing",
      sendBundleVerification: statusLine(
        sendBundleVerification?.status,
        sendBundleVerification?.passed,
        sendBundleVerification?.total
      ),
      sendBundleFingerprintGate,
      sendReceiptTemplateVerification: statusLine(
        sendReceiptTemplateVerification?.status,
        sendReceiptTemplateVerification?.passed,
        sendReceiptTemplateVerification?.total
      ),
      submittedSendReceiptValidation: submittedSendReceiptStatus,
      validationCommand: "npm run verify:first-real-tester-send-receipt-template -- --receipt <filled-send-receipt-path>",
      validationEvidencePath: "artifacts/productization/first-real-tester-send-receipt-validation.json",
      stopCondition:
        "If a manual send occurred, stop before return intake unless the filled first-real-tester send receipt validates the exact sent materials, SHA-256 fingerprints, and negative assertions."
    },
    operatorRule: {
      chooseExactlyOneReturnedLane: true,
      doNotInviteAnyoneElseBeforeGate: true,
      verifyManualSendReceiptBeforeReturnIntake: true,
      manualSendReceiptValidationCommand:
        "npm run verify:first-real-tester-send-receipt-template -- --receipt <filled-send-receipt-path>",
      manualSendReceiptValidationEvidencePath:
        "artifacts/productization/first-real-tester-send-receipt-validation.json",
      finalGateCommand: "npm run build:first-real-tester-return-gate && npm run verify:first-real-tester-return-gate",
      finalGateEvidencePath: "artifacts/productization/first-real-tester-return-gate.json"
    },
    returnedLaneWorkflows: [
      {
        id: "public_beta_tester_session",
        incomingFiles: [
          {
            id: "filled_public_beta_feedback_receipt",
            required: true,
            templatePath: "artifacts/productization/public-beta-packet/docs/PUBLIC_BETA_FEEDBACK_RECEIPT.template.json",
            validationCommand: "npm run verify:public-beta-feedback -- --receipt <feedback-path>"
          },
          {
            id: "filled_public_beta_session_receipt",
            required: true,
            templatePath: "artifacts/productization/public-beta-packet/docs/PUBLIC_BETA_SESSION_RECEIPT.template.json",
            validationCommand: "npm run verify:public-beta-session-receipt -- --receipt <session-receipt-path>"
          }
        ],
        bindingChecks: [
          "tester.name must match between feedback receipt and session receipt.",
          "tester.date must match between feedback receipt and session receipt.",
          "sessionEvidence.feedbackReceiptPath must point to the submitted feedback receipt.",
          "manualTestHumanReviewSaved must be true and backed by saved human_review evidence.",
          "If a manual send occurred, first-real-tester-send-receipt-validation.json must validate the exact sent folder, SHA-256 fingerprints, and negative assertions before return intake."
        ],
        processingCommands: [
          "npm run verify:public-beta-session-receipt -- --receipt <session-receipt-path>",
          "npm run verify:public-beta-feedback -- --receipt <feedback-path>",
          "npm run intake:public-beta-return -- --receipt <feedback-path> --session-receipt <session-receipt-path> --send-receipt-validation artifacts/productization/first-real-tester-send-receipt-validation.json",
          "npm run verify:public-beta-return-intake",
          "npm run verify:public-beta-feedback-collection",
          "npm run plan:public-beta-follow-up",
          "npm run verify:public-beta-follow-up-plan",
          "npm run build:first-real-tester-return-gate",
          "npm run verify:first-real-tester-return-gate"
        ],
        outputEvidencePaths: [
          "artifacts/productization/public-beta-return-intake.json",
          "artifacts/productization/public-beta-feedback-collection.json",
          "artifacts/productization/public-beta-follow-up-plan.json",
          "artifacts/productization/first-real-tester-return-gate.json"
        ],
        continueCondition:
          "Only continue if the return intake is processed, follow-up plan verification passes, and first-real-tester-return-gate.json explicitly allows one follow-up tester.",
        stopCondition:
          "Stop if either receipt is invalid, binding checks fail, feedback asks for fixes before more testers, or any artifact implies release, model activation, packaging unlock, or resumed all-software scope."
      },
      {
        id: "human_acceptance_review",
        incomingFiles: [
          {
            id: "filled_human_acceptance_receipt",
            required: true,
            templatePath: "artifacts/productization/human-acceptance-receipt.template.json",
            validationCommand: "npm run verify:human-acceptance-receipt -- --receipt <path>"
          }
        ],
        bindingChecks: [
          "/manual-test must save evidenceKind=human_review.",
          "Saved manual evidence must have humanReviewed=true and automationGenerated=false.",
          "Reviewer step results must include notes and blocker fields.",
          "If a manual send occurred, first-real-tester-send-receipt-validation.json must validate the exact sent folder, SHA-256 fingerprints, and negative assertions before return intake.",
          "The returned receipt itself must not set accepted=true or packagingGated=false."
        ],
        processingCommands: [
          "npm run verify:human-acceptance-receipt -- --receipt <path>",
          "npm run intake:human-acceptance-return -- --receipt <path> --send-receipt-validation artifacts/productization/first-real-tester-send-receipt-validation.json",
          "npm run verify:human-acceptance-return-intake",
          "npm run verify:human-acceptance",
          "npm run verify:product-release-readiness -- --allow-blocked",
          "npm run build:first-real-tester-return-gate",
          "npm run verify:first-real-tester-return-gate"
        ],
        outputEvidencePaths: [
          "artifacts/productization/human-acceptance-return-intake.json",
          "artifacts/productization/human-acceptance-gate.json",
          "artifacts/productization/product-release-readiness.json",
          "artifacts/productization/first-real-tester-return-gate.json"
        ],
        continueCondition:
          "Only continue after the return-intake verifier passes and the return gate is rebuilt; human review still does not release the product.",
        stopCondition:
          "Stop if saved evidence is missing, automated, self-reported only, lacks step notes, or any artifact implies release, real-model acceptance, packaging unlock, or resumed all-software scope."
      }
    ],
    blockedActions: [
      "process_two_first_returns_at_once",
      "process_first_return_without_verified_manual_send_receipt",
      "invite_additional_tester_or_reviewer_without_return_gate",
      "release_product",
      "unlock_packaging",
      "activate_real_model",
      "resume_all_software_scope"
    ],
    nextAction:
      "Before processing the first returned files, validate the filled first-real-tester send receipt if a manual send occurred; then choose exactly one returned lane here, run its processing commands, and rebuild/verify first-real-tester-return-gate before inviting anyone else."
  };

  const markdown = `# First Real Tester Return Workbench

Status: \`${workbench.status}\`

Release decision: \`${workbench.releaseDecision}\`

This is the maintainer workbench for the first real returned receipt. It does not create feedback, accept the product, activate a model, unlock packaging, or resume all-software scope.

## Operator Rule

- Choose exactly one returned lane: \`${workbench.operatorRule.chooseExactlyOneReturnedLane}\`
- Do not invite anyone else before gate: \`${workbench.operatorRule.doNotInviteAnyoneElseBeforeGate}\`
- Verify manual send receipt before return intake: \`${workbench.operatorRule.verifyManualSendReceiptBeforeReturnIntake}\`
- Manual send receipt validation command: \`${workbench.operatorRule.manualSendReceiptValidationCommand}\`
- Manual send receipt validation evidence: \`${workbench.operatorRule.manualSendReceiptValidationEvidencePath}\`
- Final gate command: \`${workbench.operatorRule.finalGateCommand}\`
- Final gate evidence: \`${workbench.operatorRule.finalGateEvidencePath}\`

## Source Evidence

| Evidence | Status |
| --- | --- |
${Object.entries(workbench.sourceEvidence)
  .map(([key, value]) => `| ${key} | \`${String(value).replaceAll("|", "\\|")}\` |`)
  .join("\n")}

## Send Receipt Handoff

| Field | Value |
| --- | --- |
| Required before return intake | \`${workbench.sendReceiptHandoff.requiredBeforeReturnIntake}\` |
| Selected lane | \`${workbench.sendReceiptHandoff.selectedLane}\` |
| Send bundle verification | \`${workbench.sendReceiptHandoff.sendBundleVerification}\` |
| Send bundle fingerprint gate | \`${workbench.sendReceiptHandoff.sendBundleFingerprintGate}\` |
| Send receipt template verification | \`${workbench.sendReceiptHandoff.sendReceiptTemplateVerification}\` |
| Submitted send receipt validation | \`${workbench.sendReceiptHandoff.submittedSendReceiptValidation}\` |
| Validation command | \`${workbench.sendReceiptHandoff.validationCommand}\` |
| Validation evidence | \`${workbench.sendReceiptHandoff.validationEvidencePath}\` |
| Stop condition | ${workbench.sendReceiptHandoff.stopCondition} |

## Returned Lane Workflows

${workbench.returnedLaneWorkflows
  .map(
    (lane) => `### ${lane.id}

Incoming files:

${markdownList(
  lane.incomingFiles.map(
    (file) =>
      `\`${file.id}\` required=\`${file.required}\`, template=\`${file.templatePath}\`, validation=\`${file.validationCommand}\``
  )
)}

Binding checks:

${markdownList(lane.bindingChecks)}

Processing commands:

${markdownList(lane.processingCommands.map((command) => `\`${command}\``))}

Output evidence:

${markdownList(lane.outputEvidencePaths.map((item) => `\`${item}\``))}

Continue condition: ${lane.continueCondition}

Stop condition: ${lane.stopCondition}
`
  )
  .join("\n")}

## Blocked Actions

${markdownList(workbench.blockedActions.map((item) => `\`${item}\``))}

## Boundary

- Product scope: \`${workbench.productScope}\`
- All-software objective: \`${workbench.allSoftwareObjective}\`
- Accepted: \`${workbench.accepted}\`
- Packaging gated: \`${workbench.packagingGated}\`
- Can release: \`${workbench.canRelease}\`
- Can activate real model: \`${workbench.canActivateRealModel}\`

## Next Action

${workbench.nextAction}
`;

  fs.mkdirSync(artifactsDir, { recursive: true });
  fs.writeFileSync(workbenchJsonPath, `${JSON.stringify(workbench, null, 2)}\n`, "utf8");
  fs.writeFileSync(workbenchMarkdownPath, markdown, "utf8");
  return workbench;
}

try {
  const workbench = buildFirstRealTesterReturnWorkbench();
  console.log(JSON.stringify(workbench, null, 2));
  console.log(`\nFirst real tester return workbench written to ${workbenchJsonPath}`);
  console.log(`First real tester return workbench Markdown written to ${workbenchMarkdownPath}`);
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}

export {};
