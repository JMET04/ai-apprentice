import fs from "node:fs";
import path from "node:path";

type VerificationCheck = {
  name: string;
  pass: boolean;
  evidence: string;
};

const artifactsDir = path.join(process.cwd(), "artifacts", "productization");
const matrixPath = path.join(artifactsDir, "product-takeover-decision-matrix.json");
const markdownPath = path.join(artifactsDir, "product-takeover-decision-matrix.md");
const receiptPath = path.join(artifactsDir, "product-takeover-decision-matrix-verification.json");

function push(checks: VerificationCheck[], name: string, pass: boolean, evidence: string) {
  checks.push({ name, pass, evidence });
}

function readJson<T>(targetPath: string): T | null {
  try {
    return JSON.parse(fs.readFileSync(targetPath, "utf8")) as T;
  } catch {
    return null;
  }
}

function fileSize(targetPath: string) {
  return fs.existsSync(targetPath) ? fs.statSync(targetPath).size : 0;
}

function main() {
  const checks: VerificationCheck[] = [];
  const matrix = readJson<{
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
    firstReadOrder?: string[];
    allowedActions?: Array<{
      id?: string;
      allowed?: boolean;
      command?: string;
      evidencePath?: string;
      testerRunbookPath?: string;
      sessionPlanPath?: string;
      sessionReceiptTemplatePath?: string;
      reviewerKitPath?: string;
      redactionChecklistPath?: string;
      postIntakeCommand?: string;
      postIntakeRefresh?: string;
      stopCondition?: string;
    }>;
    blockedActions?: Array<{ id?: string; blocked?: boolean; evidence?: string; unblockRequires?: string }>;
    releaseBlockerLanes?: Array<{ id?: string; status?: string; continueCondition?: string; stopCondition?: string }>;
    sourceEvidence?: Record<string, string>;
    failedReasons?: string[];
  }>(matrixPath);
  const markdown = fs.existsSync(markdownPath) ? fs.readFileSync(markdownPath, "utf8") : "";
  const allowedIds = new Set((matrix?.allowedActions ?? []).map((action) => action.id));
  const blockedIds = new Set((matrix?.blockedActions ?? []).map((action) => action.id));
  const laneIds = new Set((matrix?.releaseBlockerLanes ?? []).map((lane) => lane.id));

  push(
    checks,
    "Takeover matrix exists and is ready",
    matrix?.responseMode === "product_takeover_decision_matrix_json_v1" &&
      matrix.status === "ready_for_takeover" &&
      (matrix.failedReasons?.length ?? -1) === 0 &&
      fileSize(matrixPath) >= 1000 &&
      fileSize(markdownPath) >= 1000,
    `status=${matrix?.status ?? "missing"}; failed=${matrix?.failedReasons?.join(",") || "none"}; markdown=${fileSize(
      markdownPath
    )}`
  );

  push(
    checks,
    "Takeover matrix preserves product boundaries",
    matrix?.productScope === "bounded_core_teaching_loop" &&
      matrix.allSoftwareObjective === "paused" &&
      matrix.releaseDecision === "do_not_release" &&
      matrix.reviewOnly === true &&
      matrix.accepted === false &&
      matrix.packagingGated === true &&
      matrix.canRelease === false &&
      matrix.canActivateRealModel === false,
    `scope=${matrix?.productScope ?? "missing"}; release=${matrix?.releaseDecision ?? "missing"}; accepted=${
      matrix?.accepted ?? "missing"
    }; packagingGated=${matrix?.packagingGated ?? "missing"}; canRelease=${matrix?.canRelease ?? "missing"}`
  );

  push(
    checks,
    "Takeover matrix exposes first-read handoff order",
    matrix?.firstReadOrder?.[0] === "artifacts/productization/product-takeover-decision-matrix.md" &&
      matrix.firstReadOrder?.[1] === "artifacts/productization/productization-launch-checklist.md" &&
      matrix.firstReadOrder?.[2] === "artifacts/productization/first-real-tester-launch.md" &&
      matrix.firstReadOrder?.[3] === "artifacts/productization/first-real-tester-dispatch-packet/START_FIRST_REAL_TESTER.md" &&
      matrix.firstReadOrder?.[4] === "artifacts/productization/first-real-tester-send-bundle.md" &&
      matrix.firstReadOrder?.[5] === "artifacts/productization/first-real-tester-contact-readiness.md" &&
      matrix.firstReadOrder?.[6] === "artifacts/productization/first-real-tester-send-execution-brief.md" &&
      matrix.firstReadOrder?.[7] === "artifacts/productization/first-real-tester-send-receipt-template.md" &&
      matrix.firstReadOrder?.[8] === "artifacts/productization/first-real-tester-final-go-no-go.md" &&
      matrix.firstReadOrder?.[9] === "artifacts/productization/first-real-tester-return-workbench.md" &&
      matrix.firstReadOrder?.[10] === "artifacts/productization/first-real-tester-return-gate.md" &&
      matrix.firstReadOrder?.[11] === "artifacts/productization/product-status-summary.md" &&
      matrix.firstReadOrder.includes("artifacts/productization/first-real-tester-launch.md") &&
      matrix.firstReadOrder.includes("artifacts/productization/first-real-tester-dispatch-packet/START_FIRST_REAL_TESTER.md") &&
      matrix.firstReadOrder.includes("artifacts/productization/first-real-tester-send-bundle.md") &&
      matrix.firstReadOrder.includes("artifacts/productization/first-real-tester-contact-readiness.md") &&
      matrix.firstReadOrder.includes("artifacts/productization/first-real-tester-send-execution-brief.md") &&
      matrix.firstReadOrder.includes("artifacts/productization/first-real-tester-send-receipt-template.md") &&
      matrix.firstReadOrder.includes("artifacts/productization/first-real-tester-final-go-no-go.md") &&
      matrix.firstReadOrder.includes("artifacts/productization/first-real-tester-return-workbench.md") &&
      matrix.firstReadOrder.includes("artifacts/productization/first-real-tester-return-gate.md") &&
      matrix.firstReadOrder.includes("artifacts/productization/product-status-summary.md") &&
      matrix.firstReadOrder.includes("artifacts/productization/product-operator-brief.md") &&
      matrix.firstReadOrder.includes("artifacts/productization/product-release-blocker-board.md") &&
      matrix.firstReadOrder.includes("artifacts/productization/public-beta-packet/START_PUBLIC_BETA.md") &&
      matrix.firstReadOrder.includes("artifacts/productization/public-beta-packet/docs/PUBLIC_BETA_SESSION_PLAN.md") &&
      matrix.firstReadOrder.includes("artifacts/productization/public-beta-packet/docs/PUBLIC_BETA_SESSION_RECEIPT.template.json"),
    `firstRead=${matrix?.firstReadOrder?.join(" > ") ?? "missing"}`
  );

  push(
    checks,
    "Takeover matrix covers all allowed next actions",
    allowedIds.has("invite_one_bounded_beta_tester") &&
      allowedIds.has("run_real_human_acceptance_review") &&
      allowedIds.has("process_returned_human_acceptance_receipt") &&
      allowedIds.has("process_returned_public_beta_feedback") &&
      allowedIds.has("plan_real_model_trial_without_activation") &&
      allowedIds.has("process_returned_real_model_trial_receipt") &&
      allowedIds.has("process_returned_release_approval_receipt") &&
      (matrix?.allowedActions ?? []).every((action) => action.allowed === true && Boolean(action.command) && Boolean(action.stopCondition)) &&
      (matrix?.allowedActions ?? []).some(
        (action) =>
          action.id === "invite_one_bounded_beta_tester" &&
          action.testerRunbookPath === "artifacts/productization/public-beta-packet/docs/PUBLIC_BETA_TESTER_RUNBOOK.md" &&
          action.sessionPlanPath === "artifacts/productization/public-beta-packet/docs/PUBLIC_BETA_SESSION_PLAN.md" &&
          action.sessionReceiptTemplatePath ===
            "artifacts/productization/public-beta-packet/docs/PUBLIC_BETA_SESSION_RECEIPT.template.json"
      ) &&
      (matrix?.allowedActions ?? []).some(
        (action) =>
          action.id === "run_real_human_acceptance_review" &&
          action.evidencePath === "artifacts/productization/human-acceptance-reviewer-invite.md" &&
          action.reviewerKitPath === "artifacts/productization/human-acceptance-reviewer-kit.md"
      ) &&
      (matrix?.allowedActions ?? []).some(
        (action) =>
          action.id === "process_returned_public_beta_feedback" &&
          action.command ===
            "npm run intake:public-beta-return -- --receipt path/to/submitted-feedback.json --session-receipt path/to/filled-public-beta-session-receipt.json --send-receipt-validation artifacts/productization/first-real-tester-send-receipt-validation.json" &&
          action.evidencePath === "artifacts/productization/public-beta-follow-up-plan.json" &&
          action.stopCondition?.includes("more testers") === true &&
          action.stopCondition?.includes("tester.name/tester.date") === true &&
          action.stopCondition?.includes("sessionEvidence.feedbackReceiptPath") === true
      ) &&
      (matrix?.allowedActions ?? []).some(
        (action) =>
          action.id === "process_returned_human_acceptance_receipt" &&
          action.command === "npm run intake:human-acceptance-return -- --receipt path/to/filled-human-acceptance-receipt.json --send-receipt-validation artifacts/productization/first-real-tester-send-receipt-validation.json" &&
          action.evidencePath === "artifacts/productization/human-acceptance-return-intake-verification.json" &&
          action.postIntakeCommand === "npm run verify:human-acceptance-return-intake" &&
          action.postIntakeRefresh?.includes("postIntakeRefresh.commandSequence") === true &&
          action.stopCondition?.includes("human_review") === true
      ) &&
      (matrix?.allowedActions ?? []).some(
        (action) =>
          action.id === "plan_real_model_trial_without_activation" &&
          action.command === "npm run verify:real-model-adapter-contract" &&
          action.evidencePath === "artifacts/productization/real-model-trial-kit.md" &&
          action.redactionChecklistPath === "artifacts/productization/real-model-trial-kit.md#credential-redaction-checklist" &&
          action.stopCondition?.includes("credential redaction checklist") === true &&
          action.stopCondition?.includes("rollback_to_mock_after_trial") === true &&
          action.stopCondition?.includes("returned artifacts contain secrets") === true
      ) &&
      (matrix?.allowedActions ?? []).some(
        (action) =>
          action.id === "process_returned_real_model_trial_receipt" &&
          action.command === "npm run intake:real-model-trial-return -- --receipt path/to/filled-real-model-trial-receipt.json" &&
          action.evidencePath === "artifacts/productization/real-model-trial-return-intake-verification.json" &&
          action.postIntakeCommand === "npm run verify:real-model-trial-return-intake" &&
          action.stopCondition?.includes("separate acceptance") === true
      ) &&
      (matrix?.allowedActions ?? []).some(
        (action) =>
          action.id === "process_returned_release_approval_receipt" &&
          action.command === "npm run intake:product-release-approval-return -- --receipt path/to/filled-product-release-approval.json" &&
          action.evidencePath === "artifacts/productization/product-release-approval-return-intake-verification.json" &&
          action.postIntakeCommand === "npm run verify:product-release-approval-return-intake" &&
          action.stopCondition?.includes("packaging becomes unlocked") === true &&
          action.stopCondition.includes("prerequisiteEvidence.aiServiceStatusPath") &&
          action.stopCondition.includes("activeProvider=mock") &&
          action.stopCondition.includes("manualProviderAcceptance=false")
      ),
    `allowed=${Array.from(allowedIds).join(",") || "missing"}; humanInvite=${
      (matrix?.allowedActions ?? []).find((action) => action.id === "run_real_human_acceptance_review")?.evidencePath ??
      "missing"
    }`
  );

  push(
    checks,
    "Takeover matrix blocks release-only transitions",
    blockedIds.has("release_product") &&
      blockedIds.has("unlock_packaging") &&
      blockedIds.has("activate_real_model") &&
      blockedIds.has("resume_all_software_scope") &&
      (matrix?.blockedActions ?? []).every((action) => action.blocked === true && Boolean(action.unblockRequires)),
    `blocked=${Array.from(blockedIds).join(",") || "missing"}`
  );

  push(
    checks,
    "Takeover matrix carries every release blocker lane",
    laneIds.has("real_human_acceptance") &&
      laneIds.has("real_model_adapter") &&
      laneIds.has("packaging_release_lock") &&
      (matrix?.releaseBlockerLanes?.length ?? 0) === 3 &&
      (matrix?.releaseBlockerLanes ?? []).every(
        (lane) => Boolean(lane.status) && Boolean(lane.continueCondition) && Boolean(lane.stopCondition)
      ),
    `lanes=${Array.from(laneIds).join(",") || "missing"}`
  );

  push(
    checks,
    "Takeover matrix is backed by verified source evidence",
    matrix?.sourceEvidence?.statusSummary?.includes("ready_for_bounded_beta_not_release") === true &&
      matrix.sourceEvidence.operatorBrief?.includes("ready_for_operator_handoff") === true &&
      matrix.sourceEvidence.releaseBlockerBoard?.includes("ready_for_blocker_resolution") === true &&
      matrix.sourceEvidence.publicBeta?.includes("passed") === true &&
      matrix.sourceEvidence.publicBetaSessionPlan?.includes("ready=true") === true &&
      matrix.sourceEvidence.publicBetaSessionPlan.includes("PUBLIC_BETA_SESSION_PLAN.md") &&
      /passed ([1-9][0-9]*)\/\1/.test(matrix.sourceEvidence.publicBetaSessionPlan) &&
      matrix.sourceEvidence.publicBetaSessionReceipt?.includes("ready=true") === true &&
      matrix.sourceEvidence.publicBetaSessionReceipt.includes("PUBLIC_BETA_SESSION_RECEIPT.template.json") &&
      matrix.sourceEvidence.publicBetaSessionReceipt.includes("template_ready 9/9") &&
      (matrix.sourceEvidence.productTrial?.includes("passed") === true ||
        matrix.sourceEvidence.productTrial?.includes("finalPackagePending=true") === true),
    `statusSummary=${matrix?.sourceEvidence?.statusSummary ?? "missing"}; operator=${
      matrix?.sourceEvidence?.operatorBrief ?? "missing"
    }; blockers=${matrix?.sourceEvidence?.releaseBlockerBoard ?? "missing"}; beta=${
      matrix?.sourceEvidence?.publicBeta ?? "missing"
    }; trial=${matrix?.sourceEvidence?.productTrial ?? "missing"}`
  );

  push(
    checks,
    "Takeover matrix Markdown is readable and locked",
    markdown.includes("Product Takeover Decision Matrix") &&
      markdown.includes("Allowed Next Actions") &&
      markdown.includes("Blocked Actions") &&
      markdown.includes("Release Blocker Lanes") &&
      markdown.includes("PUBLIC_BETA_SESSION_PLAN.md") &&
      markdown.includes("PUBLIC_BETA_SESSION_RECEIPT.template.json") &&
      markdown.includes("sessionEvidence.feedbackReceiptPath") &&
      markdown.includes("real-model-trial-kit.md#credential-redaction-checklist") &&
      markdown.includes("rollback_to_mock_after_trial") &&
      markdown.includes("prerequisiteEvidence.aiServiceStatusPath") &&
      markdown.includes("activeProvider=mock") &&
      markdown.includes("manualProviderAcceptance=false") &&
      markdown.includes("productization-launch-checklist.md") &&
      markdown.includes("first-real-tester-launch.md") &&
      markdown.includes("first-real-tester-dispatch-packet/START_FIRST_REAL_TESTER.md") &&
      markdown.includes("first-real-tester-send-bundle.md") &&
      markdown.includes("first-real-tester-contact-readiness.md") &&
      markdown.includes("first-real-tester-send-execution-brief.md") &&
      markdown.includes("first-real-tester-send-receipt-template.md") &&
      markdown.includes("first-real-tester-final-go-no-go.md") &&
      markdown.includes("first-real-tester-return-workbench.md") &&
      markdown.includes("first-real-tester-return-gate.md") &&
      markdown.includes("do_not_release") &&
      markdown.includes("accepted=false") &&
      markdown.includes("packagingGated=true") &&
      markdown.includes("canRelease=false") &&
      !markdown.includes("Release decision: `release_candidate`") &&
      !markdown.includes("Can release: `true`"),
    `bytes=${markdown.length}`
  );

  const passed = checks.filter((check) => check.pass).length;
  const receipt = {
    responseMode: "product_takeover_decision_matrix_verification_json_v1",
    status: passed === checks.length ? "passed" : "failed",
    generatedAt: new Date().toISOString(),
    command: "npm run verify:product-takeover-matrix",
    productScope: "bounded_core_teaching_loop",
    allSoftwareObjective: "paused",
    releaseDecision: "do_not_release",
    reviewOnly: true,
    accepted: false,
    packagingGated: true,
    canRelease: false,
    canActivateRealModel: false,
    passed,
    total: checks.length,
    checks,
    nextAction:
      passed === checks.length
        ? "Use product-takeover-decision-matrix.md as the first page for maintainer takeover; open first-real-tester-final-go-no-go.md immediately before any one-person manual send."
        : "Fix the failed matrix checks, rebuild, and verify again."
  };

  fs.writeFileSync(receiptPath, JSON.stringify(receipt, null, 2));
  console.log(JSON.stringify(receipt, null, 2));
  console.log(`\nProduct takeover decision matrix verification written to ${receiptPath}`);

  if (receipt.status !== "passed") {
    process.exitCode = 1;
  }
}

try {
  main();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}

export {};

