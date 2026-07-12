import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const artifactsDir = path.join(process.cwd(), "artifacts", "productization");
const templateJsonPath = path.join(artifactsDir, "public-beta-session-receipt.template.json");
const templateMarkdownPath = path.join(artifactsDir, "public-beta-session-receipt-template.md");

function evidenceStatus(relativePath: string) {
  const fullPath = path.join(process.cwd(), relativePath);
  return {
    path: relativePath,
    exists: fs.existsSync(fullPath),
    bytes: fs.existsSync(fullPath) ? fs.statSync(fullPath).size : 0
  };
}

export function buildPublicBetaSessionReceiptTemplate() {
  const receipt = {
    responseMode: "public_beta_session_receipt_json_v1",
    status: "not_filled_yet",
    productScope: "bounded_core_teaching_loop",
    allSoftwareObjective: "paused",
    releaseDecision: "do_not_release",
    reviewOnly: true,
    accepted: false,
    packagingGated: true,
    canRelease: false,
    canActivateRealModel: false,
    defaultSessionDecision: "needs_fix_before_more_testers",
    sessionDecisionAllowedValues: ["ready_for_feedback_intake", "needs_fix_before_more_testers", "blocked"],
    facilitator: {
      name: "",
      role: "",
      date: "",
      environment: ""
    },
    tester: {
      name: "",
      role: "",
      date: "",
      environment: ""
    },
    sessionMaterials: {
      sessionPlanPath: "artifacts/productization/public-beta-packet/docs/PUBLIC_BETA_SESSION_PLAN.md",
      testerRunbookPath: "artifacts/productization/public-beta-packet/docs/PUBLIC_BETA_TESTER_RUNBOOK.md",
      feedbackReceiptTemplatePath: "artifacts/productization/public-beta-packet/docs/PUBLIC_BETA_FEEDBACK_RECEIPT.template.json",
      startHerePath: "artifacts/productization/public-beta-packet/START_PUBLIC_BETA.md"
    },
    launchPreflight: {
      command: "npm run preflight:public-beta-tester -- --base-url http://127.0.0.1:3000",
      evidencePath: "artifacts/productization/public-beta-tester-session-preflight.json",
      ranImmediatelyBeforeContact: null,
      status: "not_run_yet",
      passed: null,
      total: null
    },
    sessionEvidence: {
      publicBetaUrlOpened: null,
      stableTaskRunCompleted: null,
      publicTraceReviewed: null,
      correctionSubmitted: null,
      ruleProvenanceReviewed: null,
      rerunCompleted: null,
      manualTestHumanReviewSaved: null,
      manualTestEvidencePath: "artifacts/productization/manual-acceptance-latest.json",
      feedbackReceiptPath: "",
      screenshotOrNotesPath: ""
    },
    returnPipeline: {
      verifyFeedbackCommand: "npm run verify:public-beta-feedback -- --receipt path/to/submitted-feedback.json",
      intakeFeedbackCommand: "npm run intake:public-beta-return -- --receipt path/to/submitted-feedback.json --session-receipt path/to/filled-public-beta-session-receipt.json --send-receipt-validation artifacts/productization/first-real-tester-send-receipt-validation.json",
      verifyCollectionCommand: "npm run verify:public-beta-feedback-collection",
      followUpPlanCommand: "npm run plan:public-beta-follow-up",
      verifyFollowUpPlanCommand: "npm run verify:public-beta-follow-up-plan",
      releaseReadinessCommand: "npm run verify:product-release-readiness -- --allow-blocked",
      feedbackReceiptValidated: null,
      feedbackReceiptIntaked: null,
      followUpPlanRefreshed: null
    },
    blockers: {
      blockingIssue: "",
      confusingUx: "",
      missingEvidence: "",
      unsafeOrUnexpectedBehavior: "",
      evidencePath: ""
    },
    sessionDecision: "needs_fix_before_more_testers",
    nextActionRecommendation: "",
    locks: {
      mustNotSaveAcceptanceFromReceipt: true,
      mustNotEnableRules: true,
      mustNotUnlockPackaging: true,
      mustNotClaimReleaseReady: true,
      mustNotAcceptRealModel: true,
      mustNotResumeAllSoftwareObjective: true
    }
  };

  const markdown = `# Public Beta Session Receipt Template

Status: \`not_filled_yet\`

Use this template after one bounded beta tester session. It ties together the live preflight, session plan, tester run, manual-test evidence, returned feedback receipt, and return-intake commands.

## Commands

- \`npm run build:public-beta-session-receipt-template\`
- \`npm run verify:public-beta-session-receipt\`
- \`npm run verify:public-beta-session-receipt -- --receipt path/to/filled-public-beta-session-receipt.json\`
- \`npm run verify:public-beta-feedback -- --receipt path/to/submitted-feedback.json\`
- \`npm run intake:public-beta-return -- --receipt path/to/submitted-feedback.json --session-receipt path/to/filled-public-beta-session-receipt.json --send-receipt-validation artifacts/productization/first-real-tester-send-receipt-validation.json\`

## Required Evidence

- live tester preflight: \`artifacts/productization/public-beta-tester-session-preflight.json\`
- facilitator session plan: \`artifacts/productization/public-beta-packet/docs/PUBLIC_BETA_SESSION_PLAN.md\`
- tester runbook: \`artifacts/productization/public-beta-packet/docs/PUBLIC_BETA_TESTER_RUNBOOK.md\`
- returned feedback receipt JSON, with sessionEvidence.feedbackReceiptPath in the session receipt pointing at that JSON
- saved \`/manual-test\` evidence if the tester completed human review
- refreshed collection and follow-up plan after intake

## Boundary

This receipt is review evidence only. It must not enable rules, unlock packaging, claim release readiness, accept a real model, or resume the all-software objective.
It keeps \`accepted=false\`, \`packagingGated=true\`, \`canRelease=false\`, and \`releaseDecision=do_not_release\`.
`;

  fs.mkdirSync(artifactsDir, { recursive: true });
  fs.writeFileSync(templateJsonPath, JSON.stringify(receipt, null, 2));
  fs.writeFileSync(templateMarkdownPath, markdown);

  return {
    responseMode: "public_beta_session_receipt_template_build_json_v1",
    status: "template_built",
    generatedAt: new Date().toISOString(),
    command: "npm run build:public-beta-session-receipt-template",
    productScope: "bounded_core_teaching_loop",
    allSoftwareObjective: "paused",
    releaseDecision: "do_not_release",
    reviewOnly: true,
    accepted: false,
    packagingGated: true,
    canRelease: false,
    generatedFiles: [
      evidenceStatus("artifacts/productization/public-beta-session-receipt.template.json"),
      evidenceStatus("artifacts/productization/public-beta-session-receipt-template.md")
    ],
    nextAction:
      "Give a copy of public-beta-session-receipt.template.json to the facilitator; validate the filled copy with npm run verify:public-beta-session-receipt -- --receipt <path>."
  };
}

function main() {
  const result = buildPublicBetaSessionReceiptTemplate();
  console.log(JSON.stringify(result, null, 2));
  console.log(`\nPublic beta session receipt template written to ${templateJsonPath}`);
  console.log(`Public beta session receipt template Markdown written to ${templateMarkdownPath}`);
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
