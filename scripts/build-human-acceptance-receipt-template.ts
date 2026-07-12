import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const artifactsDir = path.join(process.cwd(), "artifacts", "productization");
const templateJsonPath = path.join(artifactsDir, "human-acceptance-receipt.template.json");
const templateMarkdownPath = path.join(artifactsDir, "human-acceptance-receipt-template.md");
const stableTaskId = "task-photo-travel-journal";

function evidenceStatus(relativePath: string) {
  const fullPath = path.join(process.cwd(), relativePath);
  return {
    path: relativePath,
    exists: fs.existsSync(fullPath),
    bytes: fs.existsSync(fullPath) ? fs.statSync(fullPath).size : 0
  };
}

export function buildHumanAcceptanceReceiptTemplate() {
  const receipt = {
    responseMode: "human_acceptance_review_receipt_json_v1",
    status: "not_filled_yet",
    productScope: "bounded_core_teaching_loop",
    stableTaskId,
    allSoftwareObjective: "paused",
    releaseDecision: "do_not_release",
    reviewOnly: true,
    accepted: false,
    packagingGated: true,
    canRelease: false,
    canActivateRealModel: false,
    humanAcceptanceDecisionAllowedValues: ["needs_follow_up", "blocked", "ready_for_gate_verification"],
    defaultHumanAcceptanceDecision: "needs_follow_up",
    reviewer: {
      name: "",
      role: "",
      date: "",
      environment: ""
    },
    reviewedFlow: {
      manualTestUrl: "http://127.0.0.1:3000/manual-test",
      runUrl: `http://127.0.0.1:3000/tasks/${stableTaskId}/run`,
      reviewUrl: `http://127.0.0.1:3000/tasks/${stableTaskId}/review`
    },
    manualTestEvidence: {
      savedReceiptPath: "",
      latestReportPath: "artifacts/productization/manual-acceptance-latest.json",
      historyReportPath: "",
      evidenceKind: "",
      humanReviewed: null,
      automationGenerated: null,
      classificationReason: ""
    },
    gateVerification: {
      gateReportPath: "artifacts/productization/human-acceptance-gate.json",
      command: "npm run verify:human-acceptance",
      status: "",
      latestEvidenceKind: "",
      latestHumanReviewed: null,
      latestAutomationGenerated: null
    },
    reviewChecks: {
      manualTestOpened: null,
      stableTaskRunCompleted: null,
      traceVisibleWithoutPrivateCot: null,
      correctionLoopReviewed: null,
      allManualStepsPassedWithNotes: null,
      manualReviewAttestationConfirmed: null,
      savedEvidenceKindHumanReview: null,
      savedEvidenceVerifiedByGate: null,
      packagingStillGated: null,
      releaseStillDoNotRelease: null,
      allSoftwareStillPaused: null,
      realModelNotAcceptedByThisReview: null
    },
    stepResults: [
      {
        id: "open_manual_test",
        status: "not_run",
        note: "",
        evidencePath: ""
      },
      {
        id: "run_stable_task",
        status: "not_run",
        note: "",
        evidencePath: ""
      },
      {
        id: "inspect_trace_and_review",
        status: "not_run",
        note: "",
        evidencePath: ""
      },
      {
        id: "exercise_correction_loop",
        status: "not_run",
        note: "",
        evidencePath: ""
      },
      {
        id: "save_human_review_evidence",
        status: "not_run",
        note: "",
        evidencePath: ""
      },
      {
        id: "maintainer_verify_gate",
        status: "not_run",
        note: "",
        evidencePath: ""
      }
    ],
    blockers: {
      blockingIssue: "",
      confusingUx: "",
      missingEvidence: "",
      unsafeOrUnexpectedBehavior: "",
      evidencePath: ""
    },
    humanAcceptanceDecision: "needs_follow_up",
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

  const markdown = `# Human Acceptance Receipt Template

Status: \`not_filled_yet\`

Use this template after one real reviewer completes the bounded \`/manual-test\` pass.

## Commands

- \`npm run build:human-acceptance-receipt-template\`
- \`npm run verify:human-acceptance-receipt\`
- \`npm run verify:human-acceptance-receipt -- --receipt path/to/filled-human-acceptance-receipt.json\`
- \`npm run verify:human-acceptance\`

## Reviewer Evidence

The filled receipt must point to saved \`human_review\` evidence from \`/manual-test\`, with:

- \`evidenceKind=human_review\`
- \`humanReviewed=true\`
- \`automationGenerated=false\`
- \`classificationReason=valid_human_review_evidence\`
- every manual step passed with notes
- \`npm run verify:human-acceptance\` run after the save
- gateVerification.gateReportPath points to artifacts/productization/human-acceptance-gate.json after npm run verify:human-acceptance has been run
- gate status is copied into the receipt as passed, with latestEvidenceKind=human_review, latestHumanReviewed=true, and latestAutomationGenerated=false

## Boundary

This receipt is review evidence only. It must not enable rules, unlock packaging, claim release readiness, accept a real model, or resume the all-software objective.
It keeps \`accepted=false\`, \`packagingGated=true\`, \`canRelease=false\`, \`canActivateRealModel=false\`, and \`releaseDecision=do_not_release\`.
`;

  fs.mkdirSync(artifactsDir, { recursive: true });
  fs.writeFileSync(templateJsonPath, JSON.stringify(receipt, null, 2));
  fs.writeFileSync(templateMarkdownPath, markdown);

  return {
    responseMode: "human_acceptance_receipt_template_build_json_v1",
    status: "template_built",
    generatedAt: new Date().toISOString(),
    command: "npm run build:human-acceptance-receipt-template",
    productScope: "bounded_core_teaching_loop",
    allSoftwareObjective: "paused",
    releaseDecision: "do_not_release",
    reviewOnly: true,
    accepted: false,
    packagingGated: true,
    canRelease: false,
    canActivateRealModel: false,
    generatedFiles: [
      evidenceStatus("artifacts/productization/human-acceptance-receipt.template.json"),
      evidenceStatus("artifacts/productization/human-acceptance-receipt-template.md")
    ],
    nextAction:
      "Give a copy of human-acceptance-receipt.template.json to the reviewer and validate the filled copy with npm run verify:human-acceptance-receipt -- --receipt <path>."
  };
}

function main() {
  const result = buildHumanAcceptanceReceiptTemplate();
  console.log(JSON.stringify(result, null, 2));
  console.log(`\nHuman acceptance receipt template written to ${templateJsonPath}`);
  console.log(`Human acceptance receipt template Markdown written to ${templateMarkdownPath}`);
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
