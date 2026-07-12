import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const artifactsDir = path.join(process.cwd(), "artifacts", "productization");
const launchJsonPath = path.join(artifactsDir, "first-real-tester-launch.json");
const launchMarkdownPath = path.join(artifactsDir, "first-real-tester-launch.md");

function readJson<T>(relativePath: string): T | null {
  try {
    return JSON.parse(fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")) as T;
  } catch {
    return null;
  }
}

function statusLine(status: string | undefined, passed?: number, total?: number) {
  if (typeof passed === "number" && typeof total === "number") return `${status ?? "missing"} ${passed}/${total}`;
  return status ?? "missing";
}

function assertPassed(
  failedReasons: string[],
  id: string,
  receipt: { status?: string; passed?: number; total?: number } | null,
  expectedStatus = "passed"
) {
  if (receipt?.status !== expectedStatus) failedReasons.push(`${id}_status_${receipt?.status ?? "missing"}`);
  if (typeof receipt?.passed === "number" || typeof receipt?.total === "number") {
    if (receipt?.passed !== receipt?.total) failedReasons.push(`${id}_not_fully_passed`);
  }
}

function markdownList(items: string[]) {
  return items.map((item) => `- ${item}`).join("\n");
}

export function buildFirstRealTesterLaunch() {
  const deliveryIndex = readJson<{
    status?: string;
    releaseDecision?: string;
    allSoftwareObjective?: string;
    accepted?: boolean;
    packagingGated?: boolean;
    canRelease?: boolean;
    canActivateRealModel?: boolean;
    finalArchive?: { path?: string; sha256?: string; verification?: string; uploadReady?: boolean };
  }>("artifacts/productization/product-delivery-index.json");
  const sourceVerification = readJson<{
    status?: string;
    uploadReady?: boolean;
    passed?: number;
    total?: number;
    archivePath?: string;
    archiveSha256?: string;
    releaseDecision?: string;
    allSoftwareObjective?: string;
    accepted?: boolean;
    packagingGated?: boolean;
    canRelease?: boolean;
    canActivateRealModel?: boolean;
    includesSecrets?: boolean;
    includesDependencies?: boolean;
    includesLocalDatabase?: boolean;
    includesBuildCache?: boolean;
    checks?: Array<{ name?: string; pass?: boolean }>;
  }>("artifacts/github-source-package/github-source-package-verification.json");
  const deliveryVerification = readJson<{ status?: string; passed?: number; total?: number }>(
    "artifacts/productization/product-delivery-index-verification.json"
  );
  const publicBetaPreflight = readJson<{
    status?: string;
    passed?: number;
    total?: number;
    canInviteTester?: boolean;
    releaseDecision?: string;
    accepted?: boolean;
    packagingGated?: boolean;
    canActivateRealModel?: boolean;
  }>("artifacts/productization/public-beta-tester-session-preflight.json");
  const humanPreflight = readJson<{
    status?: string;
    passed?: number;
    total?: number;
    canStartHumanAcceptance?: boolean;
    releaseDecision?: string;
    accepted?: boolean;
    packagingGated?: boolean;
    canActivateRealModel?: boolean;
  }>("artifacts/productization/human-acceptance-session-preflight.json");
  const betaInvite = readJson<{ status?: string; canInvite?: boolean }>("artifacts/productization/public-beta-tester-invite.json");
  const betaInviteVerification = readJson<{ status?: string; passed?: number; total?: number }>(
    "artifacts/productization/public-beta-tester-invite-verification.json"
  );
  const betaSessionPlan = readJson<{ status?: string; canStartSession?: boolean }>(
    "artifacts/productization/public-beta-session-plan.json"
  );
  const betaSessionPlanVerification = readJson<{ status?: string; passed?: number; total?: number }>(
    "artifacts/productization/public-beta-session-plan-verification.json"
  );
  const betaSessionReceiptValidation = readJson<{ status?: string; passed?: number; total?: number }>(
    "artifacts/productization/public-beta-session-receipt-validation.json"
  );
  const humanInvite = readJson<{ status?: string; canInviteHumanReviewer?: boolean }>(
    "artifacts/productization/human-acceptance-reviewer-invite.json"
  );
  const humanInviteVerification = readJson<{ status?: string; passed?: number; total?: number }>(
    "artifacts/productization/human-acceptance-reviewer-invite-verification.json"
  );
  const humanKit = readJson<{ status?: string; canStartReviewerSession?: boolean }>(
    "artifacts/productization/human-acceptance-reviewer-kit.json"
  );
  const humanKitVerification = readJson<{ status?: string; passed?: number; total?: number }>(
    "artifacts/productization/human-acceptance-reviewer-kit-verification.json"
  );
  const humanReceiptValidation = readJson<{ status?: string; passed?: number; total?: number }>(
    "artifacts/productization/human-acceptance-receipt-validation.json"
  );
  const lockAudit = readJson<{
    status?: string;
    artifactsWithMissingExplicitLocks?: number;
    artifactsWithDangerousLocks?: number;
  }>("artifacts/productization/productization-lock-coverage-audit.json");

  const sourcePackageFailedCheckNames = (sourceVerification?.checks ?? [])
    .filter((check) => check.pass !== true)
    .map((check) => check.name ?? "unnamed_source_package_check");
  const allowedSourcePackageBootstrapFailures = new Set([
    "Tester launch preflight is fresh and packaged for handoff",
    "Tester launch preflight packaging matches freshness for handoff",
    "Extracted productization CI gates refresh human, real-model, and tester preflights before final source packaging",
    "Local productization CI evidence is packaged when present"
  ]);
  const sourcePackageVerificationPassed =
    sourceVerification?.status === "passed" &&
    sourceVerification.uploadReady === true &&
    sourceVerification.passed === sourceVerification.total &&
    Number(sourceVerification.total ?? 0) >= 40;
  const sourcePackageBootstrapAllowed =
    sourceVerification?.status === "failed" &&
    sourceVerification.releaseDecision === "do_not_release" &&
    sourceVerification.allSoftwareObjective === "paused" &&
    (sourceVerification.accepted === false || sourceVerification.accepted === undefined) &&
    (sourceVerification.packagingGated === true || sourceVerification.packagingGated === undefined) &&
    (sourceVerification.canRelease === false || sourceVerification.canRelease === undefined) &&
    (sourceVerification.canActivateRealModel === false || sourceVerification.canActivateRealModel === undefined) &&
    sourceVerification.includesSecrets === false &&
    sourceVerification.includesDependencies === false &&
    sourceVerification.includesLocalDatabase === false &&
    sourceVerification.includesBuildCache === false &&
    Number(sourceVerification.total ?? 0) >= 40 &&
    Number(sourceVerification.passed ?? 0) >= Number(sourceVerification.total ?? 0) - allowedSourcePackageBootstrapFailures.size &&
    sourcePackageFailedCheckNames.length > 0 &&
    sourcePackageFailedCheckNames.every((name) => allowedSourcePackageBootstrapFailures.has(name));
  const sourcePackageReady = sourcePackageVerificationPassed || sourcePackageBootstrapAllowed;

  const failedReasons: string[] = [];
  if (!sourcePackageReady) {
    failedReasons.push(`source_package_verification_${sourceVerification?.status ?? "missing"}`);
    if (typeof sourceVerification?.passed === "number" || typeof sourceVerification?.total === "number") {
      if (sourceVerification?.passed !== sourceVerification?.total) failedReasons.push("source_package_verification_not_fully_passed");
    }
  }
  assertPassed(failedReasons, "delivery_index_verification", deliveryVerification);
  assertPassed(failedReasons, "public_beta_preflight", publicBetaPreflight);
  assertPassed(failedReasons, "human_acceptance_preflight", humanPreflight);
  assertPassed(failedReasons, "public_beta_invite_verification", betaInviteVerification);
  assertPassed(failedReasons, "public_beta_session_plan_verification", betaSessionPlanVerification);
  assertPassed(failedReasons, "public_beta_session_receipt_validation", betaSessionReceiptValidation, "template_ready");
  assertPassed(failedReasons, "human_acceptance_invite_verification", humanInviteVerification);
  assertPassed(failedReasons, "human_acceptance_kit_verification", humanKitVerification);
  assertPassed(failedReasons, "human_acceptance_receipt_validation", humanReceiptValidation, "template_ready");

  if (deliveryIndex?.status !== "ready_for_handoff") failedReasons.push("delivery_index_not_ready_for_handoff");
  if (!sourcePackageReady) failedReasons.push("source_package_not_upload_ready");
  if (publicBetaPreflight?.canInviteTester !== true) failedReasons.push("public_beta_preflight_cannot_invite_tester");
  if (humanPreflight?.canStartHumanAcceptance !== true) failedReasons.push("human_preflight_cannot_start_acceptance");
  if (betaInvite?.status !== "ready_to_invite" || betaInvite.canInvite !== true) {
    failedReasons.push("public_beta_invite_not_ready");
  }
  if (betaSessionPlan?.status !== "ready_for_session" || betaSessionPlan.canStartSession !== true) {
    failedReasons.push("public_beta_session_plan_not_ready");
  }
  if (humanInvite?.status !== "ready_to_invite_reviewer" || humanInvite.canInviteHumanReviewer !== true) {
    failedReasons.push("human_reviewer_invite_not_ready");
  }
  if (humanKit?.status !== "ready_for_reviewer" || humanKit.canStartReviewerSession !== true) {
    failedReasons.push("human_reviewer_kit_not_ready");
  }
  if (
    lockAudit?.status !== "passed" ||
    lockAudit.artifactsWithMissingExplicitLocks !== 0 ||
    lockAudit.artifactsWithDangerousLocks !== 0
  ) {
    failedReasons.push("productization_lock_audit_not_clean");
  }

  const boundaries = [
    deliveryIndex,
    publicBetaPreflight,
    humanPreflight
  ];
  if (
    boundaries.some(
      (boundary) =>
        boundary?.releaseDecision !== "do_not_release" ||
        boundary.accepted !== false ||
        boundary.packagingGated !== true ||
        boundary.canActivateRealModel !== false
    )
  ) {
    failedReasons.push("launch_boundary_lock_mismatch");
  }

  const readyToLaunch = failedReasons.length === 0;
  const launchLanes = [
    {
      id: "public_beta_tester_session",
      title: "One bounded public beta tester session",
      allowed: readyToLaunch,
      preflightCommand: "npm run preflight:public-beta-tester -- --base-url http://127.0.0.1:3000",
      preflightEvidencePath: "artifacts/productization/public-beta-tester-session-preflight.json",
      sendMaterials: [
        "artifacts/productization/public-beta-packet/docs/PUBLIC_BETA_TESTER_RUNBOOK.md",
        "artifacts/productization/public-beta-tester-invite.md",
        "artifacts/productization/public-beta-packet/docs/PUBLIC_BETA_SESSION_PLAN.md",
        "artifacts/productization/public-beta-packet/docs/PUBLIC_BETA_SESSION_RECEIPT.template.json"
      ],
      returnCommands: [
        "npm run verify:public-beta-session-receipt -- --receipt <path>",
        "npm run verify:public-beta-feedback -- --receipt <path>",
        "npm run intake:public-beta-return -- --receipt <feedback-path> --session-receipt <session-receipt-path> --send-receipt-validation artifacts/productization/first-real-tester-send-receipt-validation.json",
        "npm run verify:public-beta-feedback-collection",
        "npm run plan:public-beta-follow-up",
        "npm run verify:public-beta-follow-up-plan",
        "npm run verify:product-release-readiness -- --allow-blocked",
        "npm run build:first-real-tester-return-workbench",
        "npm run verify:first-real-tester-return-workbench",
        "npm run build:first-real-tester-return-gate",
        "npm run verify:first-real-tester-return-gate"
      ],
      stopConditions: [
        "Stop if the preflight is missing, stale, failed, or does not preserve releaseDecision=do_not_release.",
        "Stop if tester.name/tester.date differ between feedback and session receipts.",
        "Stop if sessionEvidence.feedbackReceiptPath does not point at the submitted feedback receipt.",
        "Stop if feedback asks for fixes before more testers or implies release, packaging unlock, real-model acceptance, or resumed all-software scope."
      ]
    },
    {
      id: "human_acceptance_review",
      title: "One real human acceptance review",
      allowed: readyToLaunch,
      preflightCommand: "npm run preflight:human-acceptance -- --base-url http://127.0.0.1:3000",
      preflightEvidencePath: "artifacts/productization/human-acceptance-session-preflight.json",
      sendMaterials: [
        "artifacts/productization/human-acceptance-reviewer-invite.md",
        "artifacts/productization/human-acceptance-reviewer-kit.md",
        "artifacts/productization/human-acceptance-receipt.template.json"
      ],
      returnCommands: [
        "npm run verify:human-acceptance-receipt -- --receipt <path>",
        "npm run intake:human-acceptance-return -- --receipt <path> --send-receipt-validation artifacts/productization/first-real-tester-send-receipt-validation.json",
        "npm run verify:human-acceptance-return-intake",
        "npm run verify:human-acceptance",
        "npm run verify:product-release-readiness -- --allow-blocked",
        "npm run build:first-real-tester-return-workbench",
        "npm run verify:first-real-tester-return-workbench",
        "npm run build:first-real-tester-return-gate",
        "npm run verify:first-real-tester-return-gate"
      ],
      stopConditions: [
        "Stop if the preflight is missing, stale, failed, or does not preserve releaseDecision=do_not_release.",
        "Stop if /manual-test did not save evidenceKind=human_review with humanReviewed=true.",
        "Stop if reviewer attestation, blocker notes, or required core-loop steps are missing.",
        "Stop if the receipt implies production release, packaging unlock, real-model acceptance, or resumed all-software scope."
      ]
    }
  ];

  const launch = {
    responseMode: "first_real_tester_launch_json_v1",
    status: readyToLaunch ? "ready_to_invite_one_bounded_real_tester_or_reviewer" : "blocked_before_real_tester_launch",
    generatedAt: new Date().toISOString(),
    command: "npm run build:first-real-tester-launch",
    productScope: "bounded_core_teaching_loop",
    allSoftwareObjective: "paused",
    releaseDecision: "do_not_release",
    reviewOnly: true,
    accepted: false,
    packagingGated: true,
    canRelease: false,
    canActivateRealModel: false,
    readyToLaunch,
    failedReasons,
    sourcePackageReference: {
      verificationReceiptPath: "artifacts/github-source-package/github-source-package-verification.json",
      deliveryIndexPath: "artifacts/productization/product-delivery-index.json",
      verification: `${statusLine(sourceVerification?.status, sourceVerification?.passed, sourceVerification?.total)}${sourcePackageBootstrapAllowed ? "; bootstrapAllowed=true" : ""}`,
      uploadReady: sourcePackageReady,
      bootstrapAllowed: sourcePackageBootstrapAllowed,
      note: "Use product-delivery-index.json as the current final archive pointer; this launch packet must not pin a zip SHA that changes during packaging."
    },
    sourceEvidence: {
      deliveryIndex: deliveryIndex?.status ?? "missing",
      deliveryIndexVerification: statusLine(deliveryVerification?.status, deliveryVerification?.passed, deliveryVerification?.total),
      sourcePackageVerification: `${statusLine(sourceVerification?.status, sourceVerification?.passed, sourceVerification?.total)}${sourcePackageBootstrapAllowed ? "; bootstrapAllowed=true" : ""}`,
      publicBetaPreflight: `${statusLine(publicBetaPreflight?.status, publicBetaPreflight?.passed, publicBetaPreflight?.total)}; canInvite=${publicBetaPreflight?.canInviteTester ?? "missing"}`,
      publicBetaInvite: `${betaInvite?.status ?? "missing"}; verifier=${statusLine(betaInviteVerification?.status, betaInviteVerification?.passed, betaInviteVerification?.total)}`,
      publicBetaSessionPlan: `${betaSessionPlan?.status ?? "missing"}; verifier=${statusLine(betaSessionPlanVerification?.status, betaSessionPlanVerification?.passed, betaSessionPlanVerification?.total)}`,
      publicBetaSessionReceipt: statusLine(
        betaSessionReceiptValidation?.status,
        betaSessionReceiptValidation?.passed,
        betaSessionReceiptValidation?.total
      ),
      humanAcceptancePreflight: `${statusLine(humanPreflight?.status, humanPreflight?.passed, humanPreflight?.total)}; canStart=${humanPreflight?.canStartHumanAcceptance ?? "missing"}`,
      humanReviewerInvite: `${humanInvite?.status ?? "missing"}; verifier=${statusLine(humanInviteVerification?.status, humanInviteVerification?.passed, humanInviteVerification?.total)}`,
      humanReviewerKit: `${humanKit?.status ?? "missing"}; verifier=${statusLine(humanKitVerification?.status, humanKitVerification?.passed, humanKitVerification?.total)}`,
      humanAcceptanceReceipt: statusLine(humanReceiptValidation?.status, humanReceiptValidation?.passed, humanReceiptValidation?.total),
      lockAudit: `${lockAudit?.status ?? "missing"}; missing=${lockAudit?.artifactsWithMissingExplicitLocks ?? "missing"}; dangerous=${lockAudit?.artifactsWithDangerousLocks ?? "missing"}`
    },
    launchLanes,
    maintainerChecklist: [
      "Choose exactly one lane for the first real outside pass: public_beta_tester_session or human_acceptance_review.",
      "Run that lane's preflight immediately before contact against the actual base URL.",
      "Send only the listed materials for that lane; do not send release approval or real-model activation material as acceptance evidence.",
      "Collect the returned receipt files before inviting any additional tester or reviewer.",
      "Run the lane's return commands in order, use first-real-tester-return-workbench for intake triage, then verify first-real-tester-return-gate before inviting anyone else.",
      "Keep releaseDecision=do_not_release until separate acceptance and release approval are explicit."
    ],
    blockedActions: [
      "release_product",
      "unlock_packaging",
      "activate_real_model",
      "resume_all_software_scope",
      "invite_multiple_testers_before_processing_first_return"
    ],
    nextAction: readyToLaunch
      ? "Invite one bounded real tester or human reviewer using first-real-tester-launch.md, then process the returned receipt before any wider rollout."
      : "Fix failed readiness reasons before contacting a real tester or reviewer."
  };

  const markdown = `# First Real Tester Launch

Status: \`${launch.status}\`

Ready to launch: \`${launch.readyToLaunch}\`

Release decision: \`${launch.releaseDecision}\`

This is the single-send handoff for the first real outside productization pass. It is not release approval.

## Source Package Reference

- Verification receipt: \`${launch.sourcePackageReference.verificationReceiptPath}\`
- Delivery index: \`${launch.sourcePackageReference.deliveryIndexPath}\`
- Source verification: \`${launch.sourcePackageReference.verification}\`
- Upload ready: \`${launch.sourcePackageReference.uploadReady}\`
- Note: ${launch.sourcePackageReference.note}

## Launch Lanes

${launch.launchLanes
  .map(
    (lane) => `### ${lane.title}

- ID: \`${lane.id}\`
- Allowed now: \`${lane.allowed}\`
- Preflight: \`${lane.preflightCommand}\`
- Preflight evidence: \`${lane.preflightEvidencePath}\`

Send materials:

${markdownList(lane.sendMaterials.map((item) => `\`${item}\``))}

Return commands:

${markdownList(lane.returnCommands.map((item) => `\`${item}\``))}

Stop conditions:

${markdownList(lane.stopConditions)}
`
  )
  .join("\n")}

## Maintainer Checklist

${markdownList(launch.maintainerChecklist)}

## Source Evidence

| Evidence | Status |
| --- | --- |
${Object.entries(launch.sourceEvidence)
  .map(([key, value]) => `| ${key} | \`${String(value).replaceAll("|", "\\|")}\` |`)
  .join("\n")}

## Blocked Actions

${markdownList(launch.blockedActions.map((item) => `\`${item}\``))}

## Boundary

- Product scope: \`${launch.productScope}\`
- All-software objective: \`${launch.allSoftwareObjective}\`
- Accepted: \`${launch.accepted}\`
- Packaging gated: \`${launch.packagingGated}\`
- Can release: \`${launch.canRelease}\`
- Can activate real model: \`${launch.canActivateRealModel}\`

## Failed Reasons

${failedReasons.length === 0 ? "- none" : markdownList(failedReasons)}

## Next Action

${launch.nextAction}
`;

  fs.mkdirSync(artifactsDir, { recursive: true });
  fs.writeFileSync(launchJsonPath, `${JSON.stringify(launch, null, 2)}\n`, "utf8");
  fs.writeFileSync(launchMarkdownPath, markdown, "utf8");
  return launch;
}

function main() {
  const launch = buildFirstRealTesterLaunch();
  console.log(JSON.stringify(launch, null, 2));
  console.log(`\nFirst real tester launch written to ${launchJsonPath}`);
  console.log(`First real tester launch Markdown written to ${launchMarkdownPath}`);

  if (launch.status !== "ready_to_invite_one_bounded_real_tester_or_reviewer") {
    process.exitCode = 1;
  }
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
