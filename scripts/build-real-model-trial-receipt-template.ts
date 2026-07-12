import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const artifactsDir = path.join(process.cwd(), "artifacts", "productization");
const templateJsonPath = path.join(artifactsDir, "real-model-trial-receipt.template.json");
const templateMarkdownPath = path.join(artifactsDir, "real-model-trial-receipt-template.md");

function evidenceStatus(relativePath: string) {
  const fullPath = path.join(process.cwd(), relativePath);
  return {
    path: relativePath,
    exists: fs.existsSync(fullPath),
    bytes: fs.existsSync(fullPath) ? fs.statSync(fullPath).size : 0
  };
}

export function buildRealModelTrialReceiptTemplate() {
  const receipt = {
    responseMode: "real_model_trial_receipt_json_v1",
    status: "not_filled_yet",
    productScope: "bounded_core_teaching_loop",
    allSoftwareObjective: "paused",
    releaseDecision: "do_not_release",
    reviewOnly: true,
    accepted: false,
    packagingGated: true,
    canActivateRealModel: false,
    canRelease: false,
    modelTrialDecisionAllowedValues: ["needs_follow_up", "blocked", "ready_for_separate_acceptance_review"],
    defaultModelTrialDecision: "needs_follow_up",
    reviewer: {
      name: "",
      role: "",
      date: "",
      environment: ""
    },
    redactedProviderConfig: {
      aiProvider: "",
      openAIModel: "",
      openAIBaseUrl: "",
      apiKeyRedacted: null,
      noSecretsCommitted: null,
      configSource: ""
    },
    preTrialStatus: {
      aiServiceStatusPath: "",
      activeProviderBeforeTrial: "",
      manualProviderAcceptanceBeforeTrial: null,
      releaseDecisionBeforeTrial: "",
      packagingGatedBeforeTrial: null
    },
    postTrialStatus: {
      aiServiceStatusAfterRollbackPath: "",
      activeProviderAfterRollback: "",
      manualProviderAcceptanceAfterRollback: null,
      releaseDecisionAfterTrial: "",
      packagingGatedAfterTrial: null
    },
    trialEvidence: {
      aiServiceStatusDuringTrialPath: "",
      boundedTaskRunPath: "",
      traceOrScreenshotPath: "",
      modelOutputEvidencePath: "",
      mockComparisonNotes: "",
      rollbackNotes: ""
    },
    trialChecks: {
      providerConfiguredOutsideSourceControl: null,
      realProviderActivationWasExplicitForTrial: null,
      outputTraceVisible: null,
      modelOutputComparedToMock: null,
      noSecretsInArtifacts: null,
      noRulesEnabledByTrial: null,
      noLongTermAcceptanceSaved: null,
      packagingStillGated: null,
      releaseStillDoNotRelease: null,
      allSoftwareStillPaused: null,
      rollbackToMockConfirmed: null,
    },
    blockers: {
      blockingIssue: "",
      confusingOutput: "",
      missingEvidence: "",
      unsafeOrUnexpectedBehavior: "",
      evidencePath: ""
    },
    modelTrialDecision: "needs_follow_up",
    nextActionRecommendation: "",
    locks: {
      mustNotCommitSecrets: true,
      mustNotSaveAcceptance: true,
      mustNotEnableRules: true,
      mustNotUnlockPackaging: true,
      mustNotClaimReleaseReady: true,
      mustNotResumeAllSoftwareObjective: true
    }
  };

  const markdown = `# Real Model Trial Receipt Template

Use this template after a separately approved real-provider trial. This receipt is evidence for review, not acceptance.

## Required Commands

- \`npm run build:real-model-trial-receipt-template\`
- \`npm run verify:real-model-trial-receipt\`
- \`npm run verify:real-model-trial-receipt -- --receipt path/to/filled-real-model-trial-receipt.json\`
- \`GET /api/ai-service-status\`
- \`npm run verify:product-release-readiness -- --allow-blocked\`

## How To Fill

1. Copy \`real-model-trial-receipt.template.json\`.
2. Set \`status=submitted\`.
3. Fill reviewer identity, environment, redacted provider config, trial evidence paths, and every trial check.
4. Keep \`OPENAI_API_KEY\` out of the receipt. Record only that the key was redacted.
5. Choose one allowed decision: \`needs_follow_up\`, \`blocked\`, or \`ready_for_separate_acceptance_review\`.
6. Run the validator with \`-- --receipt <path>\`.
7. After the trial, restore mock fallback and record postTrialStatus.aiServiceStatusAfterRollbackPath from GET /api/ai-service-status.
8. Set trialChecks.rollbackToMockConfirmed=true only when the post-trial status shows activeProvider=mock and manualProviderAcceptance=false.

## Boundary

- This receipt keeps \`accepted=false\`, \`packagingGated=true\`, \`releaseDecision=do_not_release\`, and \`allSoftwareObjective=paused\`.
- It cannot set \`AI_PROVIDER_MANUAL_ACCEPTED=true\`.
- It cannot activate a real model.
- It cannot save product acceptance.
- It cannot enable rules.
- It cannot unlock packaging.
- It cannot claim release readiness.
- It must include post-trial rollback evidence before it can be used for follow-up planning.
`;

  fs.mkdirSync(artifactsDir, { recursive: true });
  fs.writeFileSync(templateJsonPath, JSON.stringify(receipt, null, 2));
  fs.writeFileSync(templateMarkdownPath, markdown);

  return {
    responseMode: "real_model_trial_receipt_template_build_json_v1",
    status: "built",
    generatedAt: new Date().toISOString(),
    command: "npm run build:real-model-trial-receipt-template",
    productScope: "bounded_core_teaching_loop",
    allSoftwareObjective: "paused",
    releaseDecision: "do_not_release",
    reviewOnly: true,
    accepted: false,
    packagingGated: true,
    canActivateRealModel: false,
    canRelease: false,
    generatedFiles: [
      evidenceStatus("artifacts/productization/real-model-trial-receipt.template.json"),
      evidenceStatus("artifacts/productization/real-model-trial-receipt-template.md")
    ],
    nextAction:
      "Give real-model-trial-receipt.template.json to a real-model trial reviewer and validate a filled copy with npm run verify:real-model-trial-receipt -- --receipt <path>."
  };
}

function main() {
  const result = buildRealModelTrialReceiptTemplate();
  console.log(JSON.stringify(result, null, 2));
  console.log(`\nReal model trial receipt template written to ${templateJsonPath}`);
  console.log(`Real model trial receipt instructions written to ${templateMarkdownPath}`);
}

const currentFile = fileURLToPath(import.meta.url);
if (path.resolve(process.argv[1] ?? "") === currentFile) {
  try {
    main();
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }
}

export {};
