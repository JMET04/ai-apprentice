import fs from "node:fs";
import path from "node:path";

type Check = { name: string; pass: boolean; evidence: string };

const rootDir = process.cwd();
const artifactsDir = path.join(rootDir, "artifacts", "productization");
const checklistJsonPath = path.join(artifactsDir, "productization-launch-checklist.json");
const checklistMarkdownPath = path.join(artifactsDir, "productization-launch-checklist.md");
const receiptPath = path.join(artifactsDir, "productization-launch-checklist-verification.json");

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

function push(checks: Check[], name: string, pass: boolean, evidence: string) {
  checks.push({ name, pass, evidence });
}

function main() {
  const checks: Check[] = [];
  const checklist = readJson<{
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
    sourceEvidence?: Record<string, string>;
    launchOrder?: string[];
    lanes?: Array<{
      id?: string;
      allowed?: boolean;
      command?: string;
      evidencePath?: string;
      returnPath?: string;
      redactionChecklistPath?: string;
      stopCondition?: string;
      requiredBeforeContact?: string[];
    }>;
    blockedTransitions?: string[];
    forbiddenOutcomes?: string[];
    failedReasons?: string[];
  }>(checklistJsonPath);
  const markdown = fs.existsSync(checklistMarkdownPath) ? fs.readFileSync(checklistMarkdownPath, "utf8") : "";
  const laneIds = new Set((checklist?.lanes ?? []).map((lane) => lane.id));
  const blockedTransitions = new Set(checklist?.blockedTransitions ?? []);

  push(
    checks,
    "Productization launch checklist is ready",
    checklist?.responseMode === "productization_launch_checklist_json_v1" &&
      checklist.status === "ready_for_controlled_launch" &&
      (checklist.failedReasons?.length ?? -1) === 0 &&
      fileSize(checklistJsonPath) >= 1000 &&
      fileSize(checklistMarkdownPath) >= 1000,
    `status=${checklist?.status ?? "missing"}; failed=${checklist?.failedReasons?.join(",") || "none"}; markdown=${fileSize(
      checklistMarkdownPath
    )}`
  );

  push(
    checks,
    "Productization launch checklist preserves product locks",
    checklist?.productScope === "bounded_core_teaching_loop" &&
      checklist.allSoftwareObjective === "paused" &&
      checklist.releaseDecision === "do_not_release" &&
      checklist.reviewOnly === true &&
      checklist.accepted === false &&
      checklist.packagingGated === true &&
      checklist.canRelease === false &&
      checklist.canActivateRealModel === false &&
      markdown.includes("do_not_release") &&
      markdown.includes("Accepted: `false`") &&
      markdown.includes("Packaging gated: `true`"),
    `scope=${checklist?.productScope ?? "missing"}; release=${checklist?.releaseDecision ?? "missing"}; accepted=${
      checklist?.accepted ?? "missing"
    }; packagingGated=${checklist?.packagingGated ?? "missing"}; canRelease=${checklist?.canRelease ?? "missing"}`
  );

  push(
    checks,
    "Productization launch checklist is backed by current evidence",
    checklist?.sourceEvidence?.takeover?.includes("ready_for_takeover") === true &&
      checklist.sourceEvidence.takeover.includes("8/8") &&
      checklist.sourceEvidence.statusSummary === "ready_for_bounded_beta_not_release" &&
      (/^passed ([1-9][0-9]*)\/\1$/.test(checklist.sourceEvidence.publicBeta ?? "") ||
        /^passed [1-9][0-9]*\/[1-9][0-9]* recovery=pending_productization_evidence_freshness_refresh$/.test(
          checklist.sourceEvidence.publicBeta ?? ""
        )) &&
      (/^passed ([1-9][0-9]*)\/\1(; finalPackagePending=false)?$/.test(checklist.sourceEvidence.productTrial ?? "") ||
        checklist.sourceEvidence.productTrial?.includes("finalPackagePending=true") === true) &&
      checklist.sourceEvidence.releaseBlockerBoard?.includes("ready_for_blocker_resolution") === true &&
      checklist.sourceEvidence.humanInvite?.includes("ready_to_invite_reviewer") === true &&
      checklist.sourceEvidence.humanInvite.includes("passed 7/7") &&
      checklist.sourceEvidence.humanPreflight?.includes("passed") === true &&
      checklist.sourceEvidence.betaPreflight?.includes("passed") === true &&
      checklist.sourceEvidence.realModelKit?.includes("ready_for_real_model_trial_planning") === true &&
      checklist.sourceEvidence.releaseApprovalTemplate?.includes("template_ready") === true,
    `takeover=${checklist?.sourceEvidence?.takeover ?? "missing"}; beta=${checklist?.sourceEvidence?.publicBeta ?? "missing"}; trial=${
      checklist?.sourceEvidence?.productTrial ?? "missing"
    }; human=${checklist?.sourceEvidence?.humanInvite ?? "missing"}; model=${checklist?.sourceEvidence?.realModelKit ?? "missing"}`
  );

  push(
    checks,
    "Productization launch checklist defines controlled launch order",
    Number(checklist?.launchOrder?.length ?? 0) >= 5 &&
      checklist?.launchOrder?.[0]?.includes("Refresh live preflights") === true &&
      checklist.launchOrder.some((item) => item.includes("bounded beta")) &&
      checklist.launchOrder.some((item) => item.includes("real human acceptance")) &&
      checklist.launchOrder.some((item) => item.includes("real-model trial")) &&
      checklist.launchOrder.some((item) => item.includes("release approval")) &&
      markdown.includes("Launch Order"),
    `steps=${checklist?.launchOrder?.length ?? 0}`
  );

  push(
    checks,
    "Productization launch checklist covers launch lanes and return paths",
    laneIds.has("bounded_beta_tester") &&
      laneIds.has("real_human_acceptance") &&
      laneIds.has("real_model_trial") &&
      laneIds.has("release_approval_after_acceptance_only") &&
      (checklist?.lanes ?? []).every(
        (lane) =>
          lane.allowed === true &&
          Boolean(lane.command) &&
          Boolean(lane.evidencePath) &&
          Boolean(lane.returnPath) &&
          Boolean(lane.stopCondition) &&
          Number(lane.requiredBeforeContact?.length ?? 0) >= 1
      ) &&
      markdown.includes("intake:public-beta-return") &&
      (checklist?.lanes ?? []).some(
        (lane) =>
          lane.id === "bounded_beta_tester" &&
          lane.stopCondition?.includes("tester.name/tester.date") === true &&
          lane.stopCondition?.includes("sessionEvidence.feedbackReceiptPath") === true
      ) &&
      markdown.includes("sessionEvidence.feedbackReceiptPath") &&
      markdown.includes("intake:human-acceptance-return") &&
      markdown.includes("intake:real-model-trial-return") &&
      (checklist?.lanes ?? []).some(
        (lane) =>
          lane.id === "real_model_trial" &&
          lane.evidencePath === "artifacts/productization/real-model-trial-kit.md" &&
          lane.redactionChecklistPath === "artifacts/productization/real-model-trial-kit.md#credential-redaction-checklist" &&
          lane.stopCondition?.includes("credential redaction checklist") === true &&
          lane.stopCondition?.includes("rollback_to_mock_after_trial") === true &&
          lane.stopCondition?.includes("returned artifacts contain secrets") === true
      ) &&
      (checklist?.lanes ?? []).some(
        (lane) =>
          lane.id === "release_approval_after_acceptance_only" &&
          lane.stopCondition?.includes("prerequisiteEvidence.aiServiceStatusPath") === true &&
          lane.stopCondition.includes("activeProvider=mock") &&
          lane.stopCondition.includes("manualProviderAcceptance=false")
      ) &&
      markdown.includes("prerequisiteEvidence.aiServiceStatusPath") &&
      markdown.includes("activeProvider=mock") &&
      markdown.includes("manualProviderAcceptance=false") &&
      markdown.includes("intake:product-release-approval-return"),
    `lanes=${Array.from(laneIds).join(",") || "missing"}`
  );

  push(
    checks,
    "Productization launch checklist blocks release-only transitions",
    blockedTransitions.has("release_product") &&
      blockedTransitions.has("unlock_packaging") &&
      blockedTransitions.has("activate_real_model") &&
      blockedTransitions.has("resume_all_software_scope") &&
      checklist?.forbiddenOutcomes?.some((item) => item.includes("acceptance")) === true &&
      checklist.forbiddenOutcomes.some((item) => item.includes("unlock packaging")) &&
      checklist.forbiddenOutcomes.some((item) => item.includes("activate a real model")) &&
      markdown.includes("Blocked Transitions") &&
      markdown.includes("Forbidden Outcomes"),
    `blocked=${Array.from(blockedTransitions).join(",") || "missing"}; forbidden=${checklist?.forbiddenOutcomes?.length ?? 0}`
  );

  push(
    checks,
    "Productization launch checklist Markdown is actionable",
    markdown.includes("# Productization Launch Checklist") &&
      markdown.includes("Controlled Launch Lanes") &&
      markdown.includes("Required Return Paths") &&
      markdown.includes("real-model-trial-kit.md#credential-redaction-checklist") &&
      markdown.includes("rollback_to_mock_after_trial") &&
      markdown.includes("Source Evidence") &&
      markdown.includes("Next Action") &&
      !markdown.includes("accepted=true") &&
      !markdown.includes("packagingGated=false") &&
      !markdown.includes("releaseDecision=release_ready"),
    `bytes=${markdown.length}`
  );

  const passed = checks.filter((check) => check.pass).length;
  const receipt = {
    responseMode: "productization_launch_checklist_verification_json_v1",
    status: passed === checks.length ? "passed" : "failed",
    generatedAt: new Date().toISOString(),
    command: "npm run verify:productization-launch-checklist",
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
        ? "Use productization-launch-checklist.md as the controlled launch page for the next tester or reviewer while release stays locked."
        : "Fix the launch checklist or its source evidence before contacting testers or reviewers."
  };

  fs.writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(receipt, null, 2));
  console.log(`\nProductization launch checklist verification written to ${receiptPath}`);

  if (receipt.status !== "passed") process.exitCode = 1;
}

try {
  main();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}

export {};
