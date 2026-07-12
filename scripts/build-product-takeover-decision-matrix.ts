import fs from "node:fs";
import path from "node:path";
import {
  isPublicBetaGateReady,
  publicBetaGateStatusLine
} from "../src/server/productization/public-beta-recovery";

const artifactsDir = path.join(process.cwd(), "artifacts", "productization");
const matrixJsonPath = path.join(artifactsDir, "product-takeover-decision-matrix.json");
const matrixMarkdownPath = path.join(artifactsDir, "product-takeover-decision-matrix.md");

function readJson<T>(relativePath: string): T | null {
  try {
    return JSON.parse(fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")) as T;
  } catch {
    return null;
  }
}

function markdownEscape(value: string) {
  return value.replaceAll("|", "\\|");
}

function statusLine(status: string | undefined, passed?: number, total?: number) {
  if (typeof passed === "number" && typeof total === "number") return `${status ?? "missing"} ${passed}/${total}`;
  return status ?? "missing";
}

function productTrialReadyForTakeover(receipt: {
  status?: string;
  passed?: number;
  total?: number;
  canRelease?: boolean;
  checks?: Array<{ name?: string; pass?: boolean }>;
} | null) {
  if (receipt?.canRelease !== false) return false;
  if (receipt.status === "passed" && receipt.passed === receipt.total) return true;

  const failedChecks = (receipt.checks ?? []).filter((check) => check.pass !== true).map((check) => check.name ?? "missing");
  return (
    receipt.status === "failed" &&
    failedChecks.length === 1 &&
    failedChecks[0] === "Productization freshness evidence is packaged and green" &&
    (receipt.passed ?? 0) + failedChecks.length === receipt.total
  );
}
export function buildProductTakeoverDecisionMatrix() {
  const summary = readJson<{
    status?: string;
    betaCanStart?: boolean;
    releaseDecision?: string;
    canRelease?: boolean;
    canActivateRealModel?: boolean;
    accepted?: boolean;
    packagingGated?: boolean;
    nextBestActions?: Array<{
      id?: string;
      allowed?: boolean;
      command?: string;
      evidencePath?: string;
      testerRunbookPath?: string;
      sessionPlanPath?: string;
      sessionReceiptTemplatePath?: string;
    }>;
    blockedActions?: string[];
    readiness?: Record<string, string>;
  }>("artifacts/productization/product-status-summary.json");
  const summaryVerification = readJson<{ status?: string; passed?: number; total?: number }>(
    "artifacts/productization/product-status-summary-verification.json"
  );
  const operatorBrief = readJson<{
    status?: string;
    releaseDecision?: string;
    canInviteBoundedBetaTester?: boolean;
    canStartHumanAcceptanceReview?: boolean;
    canProcessBetaFeedbackLoop?: boolean;
    canPlanRealModelTrial?: boolean;
    canRelease?: boolean;
    canActivateRealModel?: boolean;
    immediateActions?: Array<{
      id?: string;
      title?: string;
      allowed?: boolean;
      command?: string;
      evidencePath?: string;
      testerRunbookPath?: string;
      sessionPlanPath?: string;
      sessionReceiptTemplatePath?: string;
      stopCondition?: string;
    }>;
    blockedActions?: Array<{ id?: string; blocked?: boolean; reason?: string }>;
  }>("artifacts/productization/product-operator-brief.json");
  const operatorBriefVerification = readJson<{ status?: string; passed?: number; total?: number }>(
    "artifacts/productization/product-operator-brief-verification.json"
  );
  const blockerBoard = readJson<{
    status?: string;
    releaseDecision?: string;
    accepted?: boolean;
    packagingGated?: boolean;
    canRelease?: boolean;
    lanes?: Array<{
      id?: string;
      title?: string;
      status?: string;
      currentEvidence?: string;
      commands?: string[];
      continueCondition?: string;
      stopCondition?: string;
      evidencePaths?: string[];
    }>;
  }>("artifacts/productization/product-release-blocker-board.json");
  const blockerBoardVerification = readJson<{ status?: string; passed?: number; total?: number }>(
    "artifacts/productization/product-release-blocker-board-verification.json"
  );
  const publicBeta = readJson<{
    status?: string;
    betaCanStart?: boolean;
    passed?: number;
    total?: number;
    releaseDecision?: string;
    checks?: Array<{ name?: string; pass?: boolean; evidence?: string }>;
  }>("artifacts/productization/public-beta-readiness.json");
  const trialVerification = readJson<{
    status?: string;
    passed?: number;
    total?: number;
    canRelease?: boolean;
    checks?: Array<{ name?: string; pass?: boolean }>;
  }>("artifacts/productization/product-trial-packet-verification.json");
  const humanReturnIntakeVerification = readJson<{
    status?: string;
    passed?: number;
    total?: number;
    releaseDecision?: string;
    accepted?: boolean;
    packagingGated?: boolean;
    canRelease?: boolean;
  }>("artifacts/productization/human-acceptance-return-intake-verification.json");
  const realModelReturnIntakeVerification = readJson<{
    status?: string;
    passed?: number;
    total?: number;
    releaseDecision?: string;
    accepted?: boolean;
    packagingGated?: boolean;
    canActivateRealModel?: boolean;
    canRelease?: boolean;
  }>("artifacts/productization/real-model-trial-return-intake-verification.json");
  const releaseApprovalReturnIntakeVerification = readJson<{
    status?: string;
    passed?: number;
    total?: number;
    releaseDecision?: string;
    accepted?: boolean;
    packagingGated?: boolean;
    canRelease?: boolean;
  }>("artifacts/productization/product-release-approval-return-intake-verification.json");

  const publicBetaGateReadyForMatrix = isPublicBetaGateReady(publicBeta);
  const productTrialReady = productTrialReadyForTakeover(trialVerification);

  const allowedActions = [
    {
      id: "invite_one_bounded_beta_tester",
      title: "Invite one bounded beta tester",
      allowed:
        summary?.betaCanStart === true &&
        publicBetaGateReadyForMatrix &&
        operatorBrief?.canInviteBoundedBetaTester === true,
      command: "npm run preflight:public-beta-tester -- --base-url http://127.0.0.1:3000",
      evidencePath: "artifacts/productization/public-beta-packet/START_PUBLIC_BETA.md",
      testerRunbookPath: "artifacts/productization/public-beta-packet/docs/PUBLIC_BETA_TESTER_RUNBOOK.md",
      sessionPlanPath: "artifacts/productization/public-beta-packet/docs/PUBLIC_BETA_SESSION_PLAN.md",
      sessionReceiptTemplatePath: "artifacts/productization/public-beta-packet/docs/PUBLIC_BETA_SESSION_RECEIPT.template.json",
      stopCondition:
        "Stop if preflight fails, betaCanStart is false, tester runbook, session plan, or session receipt template is missing, or releaseDecision is not do_not_release."
    },
    {
      id: "run_real_human_acceptance_review",
      title: "Run real human acceptance review",
      allowed: operatorBrief?.canStartHumanAcceptanceReview === true,
      command: "npm run preflight:human-acceptance -- --base-url http://127.0.0.1:3000",
      evidencePath: "artifacts/productization/human-acceptance-reviewer-invite.md",
      reviewerKitPath: "artifacts/productization/human-acceptance-reviewer-kit.md",
      stopCondition:
        "Stop if the invite is stale, the preflight fails, the reviewer cannot attest the core loop, latest evidence is automated_browser_smoke, or any required manual step is blocked."
    },
    {
      id: "process_returned_human_acceptance_receipt",
      title: "Process returned human acceptance receipt",
      allowed:
        humanReturnIntakeVerification?.status === "passed" &&
        humanReturnIntakeVerification.passed === humanReturnIntakeVerification.total &&
        humanReturnIntakeVerification.releaseDecision === "do_not_release" &&
        humanReturnIntakeVerification.accepted === false &&
        humanReturnIntakeVerification.packagingGated === true &&
        humanReturnIntakeVerification.canRelease === false,
      command: "npm run intake:human-acceptance-return -- --receipt path/to/filled-human-acceptance-receipt.json --send-receipt-validation artifacts/productization/first-real-tester-send-receipt-validation.json",
      evidencePath: "artifacts/productization/human-acceptance-return-intake-verification.json",
      postIntakeCommand: "npm run verify:human-acceptance-return-intake",
      postIntakeRefresh:
        "After the return-intake verifier passes, run the intake receipt's postIntakeRefresh.commandSequence before relying on reviewer invite, blocker board, status summary, takeover matrix, or evidence freshness files.",
      stopCondition:
        "Stop if the receipt is invalid, the return-intake verifier fails, /manual-test did not save human_review evidence, releaseDecision changes, or packaging becomes unlocked."
    },
    {
      id: "process_returned_public_beta_feedback",
      title: "Process returned public beta feedback",
      allowed: operatorBrief?.canProcessBetaFeedbackLoop === true,
      command: "npm run intake:public-beta-return -- --receipt path/to/submitted-feedback.json --session-receipt path/to/filled-public-beta-session-receipt.json --send-receipt-validation artifacts/productization/first-real-tester-send-receipt-validation.json",
      evidencePath: "artifacts/productization/public-beta-follow-up-plan.json",
      stopCondition:
        "Stop if either receipt is invalid, tester.name/tester.date do not match, sessionEvidence.feedbackReceiptPath does not point at the submitted feedback receipt, feedback is blocked, requests fixes before more testers, or implies release/all-software acceptance."
    },
    {
      id: "plan_real_model_trial_without_activation",
      title: "Plan a separate real-model trial without activation",
      allowed: operatorBrief?.canPlanRealModelTrial === true && operatorBrief.canActivateRealModel === false,
      command: "npm run verify:real-model-adapter-contract",
      evidencePath: "artifacts/productization/real-model-trial-kit.md",
      redactionChecklistPath: "artifacts/productization/real-model-trial-kit.md#credential-redaction-checklist",
      stopCondition:
        "Stop if credentials would enter source control, realNetworkUsed appears in adapter evidence, or model acceptance is missing. Stop if the credential redaction checklist at artifacts/productization/real-model-trial-kit.md#credential-redaction-checklist is incomplete, returned artifacts contain secrets, or rollback_to_mock_after_trial is not confirmed."
    },
    {
      id: "process_returned_real_model_trial_receipt",
      title: "Process returned real-model trial receipt",
      allowed:
        realModelReturnIntakeVerification?.status === "passed" &&
        realModelReturnIntakeVerification.passed === realModelReturnIntakeVerification.total &&
        realModelReturnIntakeVerification.releaseDecision === "do_not_release" &&
        realModelReturnIntakeVerification.accepted === false &&
        realModelReturnIntakeVerification.packagingGated === true &&
        realModelReturnIntakeVerification.canActivateRealModel === false &&
        realModelReturnIntakeVerification.canRelease === false,
      command: "npm run intake:real-model-trial-return -- --receipt path/to/filled-real-model-trial-receipt.json",
      evidencePath: "artifacts/productization/real-model-trial-return-intake-verification.json",
      postIntakeCommand: "npm run verify:real-model-trial-return-intake",
      stopCondition:
        "Stop if the receipt is invalid, the return-intake verifier fails, realNetwork evidence is missing, releaseDecision changes, the real model becomes active without separate acceptance, or packaging becomes unlocked."
    },
    {
      id: "process_returned_release_approval_receipt",
      title: "Process returned release approval receipt",
      allowed:
        releaseApprovalReturnIntakeVerification?.status === "passed" &&
        releaseApprovalReturnIntakeVerification.passed === releaseApprovalReturnIntakeVerification.total &&
        releaseApprovalReturnIntakeVerification.releaseDecision === "do_not_release" &&
        releaseApprovalReturnIntakeVerification.accepted === false &&
        releaseApprovalReturnIntakeVerification.packagingGated === true &&
        releaseApprovalReturnIntakeVerification.canRelease === false,
      command: "npm run intake:product-release-approval-return -- --receipt path/to/filled-product-release-approval.json",
      evidencePath: "artifacts/productization/product-release-approval-return-intake-verification.json",
      postIntakeCommand: "npm run verify:product-release-approval-return-intake",
      stopCondition:
        "Stop if the receipt is invalid, the return-intake verifier fails, human or model acceptance evidence is missing, releaseDecision changes, accepted becomes true, or packaging becomes unlocked. Stop if prerequisiteEvidence.aiServiceStatusPath is missing, does not point to post-trial GET /api/ai-service-status JSON, or does not prove activeProvider=mock, realModelReady=false, manualProviderAcceptance=false, accepted=false, and packagingGated=true."
    }
  ];

  const blockedActions = [
    {
      id: "release_product",
      blocked: true,
      evidence: summary?.readiness?.release ?? "missing",
      unblockRequires: "Real human acceptance, separate real-model acceptance, and explicit release approval."
    },
    {
      id: "unlock_packaging",
      blocked: true,
      evidence: `accepted=${summary?.accepted ?? "missing"}; packagingGated=${summary?.packagingGated ?? "missing"}`,
      unblockRequires: "A separate release approval process after human and model acceptance."
    },
    {
      id: "activate_real_model",
      blocked: true,
      evidence: summary?.readiness?.realModel ?? "missing",
      unblockRequires: "A real-provider trial receipt plus explicit human acceptance for that model."
    },
    {
      id: "resume_all_software_scope",
      blocked: true,
      evidence: "allSoftwareObjective=paused",
      unblockRequires: "A separate product decision outside this bounded core-loop beta."
    }
  ];

  const sourceEvidence = {
    statusSummary: statusLine(summary?.status, summaryVerification?.passed, summaryVerification?.total),
    operatorBrief: statusLine(operatorBrief?.status, operatorBriefVerification?.passed, operatorBriefVerification?.total),
    releaseBlockerBoard: statusLine(blockerBoard?.status, blockerBoardVerification?.passed, blockerBoardVerification?.total),
    publicBeta: publicBetaGateStatusLine(publicBeta) ?? statusLine(publicBeta?.status, publicBeta?.passed, publicBeta?.total),
    publicBetaSessionPlan: summary?.readiness?.publicBetaSessionPlan ?? "missing",
    publicBetaSessionReceipt: summary?.readiness?.publicBetaSessionReceipt ?? "missing",
    productTrial: `${statusLine(trialVerification?.status, trialVerification?.passed, trialVerification?.total)}; finalPackagePending=${trialVerification?.status !== "passed" && productTrialReady}`,
    realModelReturnIntake: statusLine(
      realModelReturnIntakeVerification?.status,
      realModelReturnIntakeVerification?.passed,
      realModelReturnIntakeVerification?.total
    ),
    releaseApprovalReturnIntake: statusLine(
      releaseApprovalReturnIntakeVerification?.status,
      releaseApprovalReturnIntakeVerification?.passed,
      releaseApprovalReturnIntakeVerification?.total
    )
  };

  const failedReasons: string[] = [];
  if (summary?.status !== "ready_for_bounded_beta_not_release") failedReasons.push("status_summary_not_ready");
  if (summaryVerification?.status !== "passed") failedReasons.push("status_summary_not_verified");
  if (operatorBrief?.status !== "ready_for_operator_handoff") failedReasons.push("operator_brief_not_ready");
  if (operatorBriefVerification?.status !== "passed") failedReasons.push("operator_brief_not_verified");
  if (blockerBoard?.status !== "ready_for_blocker_resolution") failedReasons.push("blocker_board_not_ready");
  if (blockerBoardVerification?.status !== "passed") failedReasons.push("blocker_board_not_verified");
  if (!publicBetaGateReadyForMatrix) failedReasons.push("public_beta_not_ready");
  if (!summary?.readiness?.publicBetaSessionReceipt?.includes("template_ready 9/9")) {
    failedReasons.push("public_beta_session_receipt_not_ready");
  }
  if (!productTrialReady) {
    failedReasons.push("product_trial_not_verified_or_unlocked");
  }
  if (summary?.releaseDecision !== "do_not_release" || operatorBrief?.releaseDecision !== "do_not_release") {
    failedReasons.push("release_decision_not_locked");
  }
  if (summary?.canRelease !== false || operatorBrief?.canRelease !== false || blockerBoard?.canRelease !== false) {
    failedReasons.push("release_unlock_detected");
  }
  if (summary?.canActivateRealModel !== false || operatorBrief?.canActivateRealModel !== false) {
    failedReasons.push("real_model_unlock_detected");
  }
  if (summary?.accepted !== false || summary?.packagingGated !== true) {
    failedReasons.push("packaging_boundary_not_locked");
  }
  if (!allowedActions.every((action) => action.allowed === true)) failedReasons.push("allowed_actions_not_ready");
  if ((blockerBoard?.lanes?.length ?? 0) !== 3) failedReasons.push("release_blocker_lanes_incomplete");

  const matrix = {
    responseMode: "product_takeover_decision_matrix_json_v1",
    status: failedReasons.length === 0 ? "ready_for_takeover" : "needs_productization_work",
    generatedAt: new Date().toISOString(),
    command: "npm run build:product-takeover-matrix",
    productScope: "bounded_core_teaching_loop",
    allSoftwareObjective: "paused",
    releaseDecision: "do_not_release",
    reviewOnly: true,
    accepted: false,
    packagingGated: true,
    canRelease: false,
    canActivateRealModel: false,
    firstReadOrder: [
      "artifacts/productization/product-takeover-decision-matrix.md",
      "artifacts/productization/productization-launch-checklist.md",
      "artifacts/productization/first-real-tester-launch.md",
      "artifacts/productization/first-real-tester-dispatch-packet/START_FIRST_REAL_TESTER.md",
      "artifacts/productization/first-real-tester-send-bundle.md",
      "artifacts/productization/first-real-tester-contact-readiness.md",
      "artifacts/productization/first-real-tester-send-execution-brief.md",
      "artifacts/productization/first-real-tester-send-receipt-template.md",
      "artifacts/productization/first-real-tester-final-go-no-go.md",
      "artifacts/productization/first-real-tester-return-workbench.md",
      "artifacts/productization/first-real-tester-return-gate.md",
      "artifacts/productization/product-status-summary.md",
      "artifacts/productization/product-operator-brief.md",
      "artifacts/productization/product-release-blocker-board.md",
      "artifacts/productization/public-beta-packet/START_PUBLIC_BETA.md",
      "artifacts/productization/public-beta-packet/docs/PUBLIC_BETA_SESSION_PLAN.md",
      "artifacts/productization/public-beta-packet/docs/PUBLIC_BETA_SESSION_RECEIPT.template.json"
    ],
    allowedActions,
    blockedActions,
    releaseBlockerLanes: blockerBoard?.lanes ?? [],
    sourceEvidence,
    failedReasons,
    nextAction:
      failedReasons.length === 0
        ? "Use this matrix as the first takeover page; choose one allowed action, open first-real-tester-final-go-no-go.md immediately before any one-person manual send, and obey the selected stop condition."
        : "Refresh the failed source evidence, rebuild this matrix, and verify it again."
  };

  const allowedRows = allowedActions
    .map(
      (action) =>
        `| ${markdownEscape(action.title)} | \`${action.allowed}\` | \`${markdownEscape(
          action.command
        )}\` | \`${markdownEscape(action.evidencePath)}\` | ${"sessionPlanPath" in action ? `Session plan: \`${markdownEscape(action.sessionPlanPath ?? "missing")}\`; ` : ""}${"sessionReceiptTemplatePath" in action ? `Session receipt: \`${markdownEscape(action.sessionReceiptTemplatePath ?? "missing")}\`; ` : ""}${markdownEscape(action.stopCondition)} |`
    )
    .join("\n");
  const blockedRows = blockedActions
    .map(
      (action) =>
        `| ${markdownEscape(action.id)} | \`${action.blocked}\` | ${markdownEscape(action.evidence)} | ${markdownEscape(
          action.unblockRequires
        )} |`
    )
    .join("\n");
  const laneRows = (blockerBoard?.lanes ?? [])
    .map(
      (lane) =>
        `| ${markdownEscape(lane.title ?? lane.id ?? "missing")} | \`${lane.status ?? "missing"}\` | ${markdownEscape(
          lane.currentEvidence ?? "missing"
        )} | ${markdownEscape(lane.continueCondition ?? "missing")} | ${markdownEscape(lane.stopCondition ?? "missing")} |`
    )
    .join("\n");

  const markdown = `# Product Takeover Decision Matrix

Status: \`${matrix.status}\`

Scope: \`${matrix.productScope}\`

Release decision: \`${matrix.releaseDecision}\`

This is the first page for a maintainer taking over the bounded productization track. It chooses from current verified evidence; it does not accept the product, activate a real model, unlock packaging, or resume all-software scope.

## First Read Order

${matrix.firstReadOrder.map((item, index) => `${index + 1}. \`${item}\``).join("\n")}

## Allowed Next Actions

| Action | Allowed | Command | Evidence | Stop condition |
| --- | --- | --- | --- | --- |
${allowedRows}

## Blocked Actions

| Action | Blocked | Evidence | Unblock requires |
| --- | --- | --- | --- |
${blockedRows}

## Release Blocker Lanes

| Lane | Status | Current evidence | Continue condition | Stop condition |
| --- | --- | --- | --- | --- |
${laneRows}

## Source Evidence

| Source | Status |
| --- | --- |
| Status summary | \`${sourceEvidence.statusSummary}\` |
| Operator brief | \`${sourceEvidence.operatorBrief}\` |
| Release blocker board | \`${sourceEvidence.releaseBlockerBoard}\` |
| Public beta | \`${sourceEvidence.publicBeta}\` |
| Public beta session plan | \`${sourceEvidence.publicBetaSessionPlan}\` |
| Public beta session receipt | \`${sourceEvidence.publicBetaSessionReceipt}\` |
| Product trial | \`${sourceEvidence.productTrial}\` |
| Real-model return intake | \`${sourceEvidence.realModelReturnIntake}\` |
| Release approval return intake | \`${sourceEvidence.releaseApprovalReturnIntake}\` |

## Boundary

- This matrix is review-only.
- It keeps \`accepted=false\`, \`packagingGated=true\`, \`canRelease=false\`, and \`canActivateRealModel=false\`.
- It cannot save acceptance, enable rules, activate a real model, unlock packaging, claim release readiness, or resume all-software scope.

## Failed Reasons

${failedReasons.length ? failedReasons.map((reason) => `- ${reason}`).join("\n") : "- none"}
`;

  fs.mkdirSync(artifactsDir, { recursive: true });
  fs.writeFileSync(matrixJsonPath, JSON.stringify(matrix, null, 2));
  fs.writeFileSync(matrixMarkdownPath, markdown);
  console.log(JSON.stringify(matrix, null, 2));
  console.log(`\nProduct takeover decision matrix written to ${matrixJsonPath}`);
  return matrix;
}

try {
  buildProductTakeoverDecisionMatrix();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}

export {};



