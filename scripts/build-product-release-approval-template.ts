import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const artifactsDir = path.join(process.cwd(), "artifacts", "productization");
const templateJsonPath = path.join(artifactsDir, "product-release-approval.template.json");
const templateMarkdownPath = path.join(artifactsDir, "product-release-approval-template.md");

function evidenceStatus(relativePath: string) {
  const fullPath = path.join(process.cwd(), relativePath);
  return {
    path: relativePath,
    exists: fs.existsSync(fullPath),
    bytes: fs.existsSync(fullPath) ? fs.statSync(fullPath).size : 0
  };
}

export function buildProductReleaseApprovalTemplate() {
  const receipt = {
    responseMode: "product_release_approval_receipt_json_v1",
    status: "not_filled_yet",
    productScope: "bounded_core_teaching_loop",
    allSoftwareObjective: "paused",
    releaseDecision: "do_not_release",
    reviewOnly: true,
    accepted: false,
    packagingGated: true,
    canRelease: false,
    releaseApprovalDecisionAllowedValues: ["needs_follow_up", "blocked", "ready_for_separate_release_review"],
    defaultReleaseApprovalDecision: "needs_follow_up",
    reviewer: {
      name: "",
      role: "",
      date: "",
      environment: ""
    },
    prerequisiteEvidence: {
      productReleaseReadinessPath: "artifacts/productization/product-release-readiness.json",
      productReleaseReadinessStatus: "",
      blockerCountBeforeApproval: null,
      humanAcceptanceGatePath: "artifacts/productization/human-acceptance-gate.json",
      humanAcceptanceGateStatus: "",
      humanAcceptanceReceiptValidationPath: "artifacts/productization/human-acceptance-receipt-validation.json",
      humanAcceptanceReceiptValidationStatus: "",
      aiServiceStatusPath: "",
      realModelReady: null,
      realModelTrialReceiptValidationPath: "artifacts/productization/real-model-trial-receipt-validation.json",
      realModelTrialReceiptValidationStatus: "",
      publicBetaReadinessPath: "artifacts/productization/public-beta-readiness.json",
      publicBetaReadinessStatus: "",
      githubSourcePackagePath: "",
      githubSourcePackageVerificationPath: "artifacts/github-source-package/github-source-package-verification.json",
      githubSourcePackageVerificationStatus: ""
    },
    approvalChecks: {
      productReleaseReadinessReviewed: null,
      humanAcceptancePassed: null,
      humanAcceptanceReceiptValidated: null,
      realModelAcceptedSeparately: null,
      realModelReceiptValidated: null,
      publicBetaReadinessReviewed: null,
      sourcePackageBuiltWithoutSecrets: null,
      releaseNotesReviewed: null,
      rollbackPlanReviewed: null,
      packagingStillGated: null,
      releaseStillDoNotRelease: null,
      allSoftwareStillPaused: null
    },
    approvalSteps: [
      {
        id: "review_release_readiness",
        status: "not_run",
        note: "",
        evidencePath: ""
      },
      {
        id: "confirm_human_acceptance",
        status: "not_run",
        note: "",
        evidencePath: ""
      },
      {
        id: "confirm_real_model_acceptance",
        status: "not_run",
        note: "",
        evidencePath: ""
      },
      {
        id: "inspect_public_beta_and_source_package",
        status: "not_run",
        note: "",
        evidencePath: ""
      },
      {
        id: "review_release_notes_and_rollback",
        status: "not_run",
        note: "",
        evidencePath: ""
      },
      {
        id: "record_separate_release_review_decision",
        status: "not_run",
        note: "",
        evidencePath: ""
      }
    ],
    blockers: {
      blockingIssue: "",
      missingEvidence: "",
      releaseRisk: "",
      rollbackConcern: "",
      evidencePath: ""
    },
    releaseApprovalDecision: "needs_follow_up",
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

  const markdown = `# Product Release Approval Receipt Template

Status: \`not_filled_yet\`

Use this template only after real human acceptance, separate real-model acceptance, post-trial mock rollback evidence, public beta evidence, and a clean source package are available for review.

## Commands

- \`npm run build:product-release-approval-template\`
- \`npm run verify:product-release-approval\`
- \`npm run verify:product-release-approval -- --receipt path/to/filled-product-release-approval.json\`
- \`npm run verify:product-release-readiness -- --allow-blocked\`

## Required Evidence

- \`artifacts/productization/human-acceptance-gate.json\`
- \`artifacts/productization/human-acceptance-receipt-validation.json\`
- \`artifacts/productization/real-model-trial-receipt-validation.json\`
- \`artifacts/productization/public-beta-readiness.json\`
- latest \`artifacts/github-source-package/*.zip\`\n- \`artifacts/github-source-package/github-source-package-verification.json\` whose \`archivePath\` matches that zip and whose package-boundary checks pass

## Boundary

This receipt is release-review evidence only. It must not enable rules, unlock packaging, claim release readiness, accept a real model, or resume the all-software objective by itself.
It keeps \`accepted=false\`, \`packagingGated=true\`, \`canRelease=false\`, and \`releaseDecision=do_not_release\`.
`;

  fs.mkdirSync(artifactsDir, { recursive: true });
  fs.writeFileSync(templateJsonPath, JSON.stringify(receipt, null, 2));
  fs.writeFileSync(templateMarkdownPath, markdown);

  return {
    responseMode: "product_release_approval_template_build_json_v1",
    status: "template_built",
    generatedAt: new Date().toISOString(),
    command: "npm run build:product-release-approval-template",
    productScope: "bounded_core_teaching_loop",
    allSoftwareObjective: "paused",
    releaseDecision: "do_not_release",
    reviewOnly: true,
    accepted: false,
    packagingGated: true,
    canRelease: false,
    generatedFiles: [
      evidenceStatus("artifacts/productization/product-release-approval.template.json"),
      evidenceStatus("artifacts/productization/product-release-approval-template.md")
    ],
    nextAction:
      "Give a copy of product-release-approval.template.json to the release reviewer only after human and model acceptance evidence exists; validate a filled copy with npm run verify:product-release-approval -- --receipt <path>."
  };
}

function main() {
  const result = buildProductReleaseApprovalTemplate();
  console.log(JSON.stringify(result, null, 2));
  console.log(`\nProduct release approval template written to ${templateJsonPath}`);
  console.log(`Product release approval template Markdown written to ${templateMarkdownPath}`);
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
