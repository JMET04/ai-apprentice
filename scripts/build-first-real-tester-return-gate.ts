import fs from "node:fs";
import path from "node:path";

type JsonRecord = Record<string, any>;

const artifactsDir = path.join(process.cwd(), "artifacts", "productization");
const gateJsonPath = path.join(artifactsDir, "first-real-tester-return-gate.json");
const gateMarkdownPath = path.join(artifactsDir, "first-real-tester-return-gate.md");

function readJson<T = JsonRecord>(relativePath: string): T | null {
  try {
    return JSON.parse(fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")) as T;
  } catch {
    return null;
  }
}

function exists(relativePath: string): boolean {
  return fs.existsSync(path.join(process.cwd(), relativePath));
}

function statusLine(status?: string, passed?: number, total?: number): string {
  if (!status) return "missing";
  if (typeof passed === "number" && typeof total === "number") return `${status} ${passed}/${total}`;
  return status;
}

function markdownList(items: string[]): string {
  return items.map((item) => `- ${item}`).join("\n");
}

function buildFirstRealTesterReturnGate() {
  const launch = readJson<{
    status?: string;
    readyToLaunch?: boolean;
    releaseDecision?: string;
    accepted?: boolean;
    packagingGated?: boolean;
    canRelease?: boolean;
    canActivateRealModel?: boolean;
  }>("artifacts/productization/first-real-tester-launch.json");
  const launchVerification = readJson<{ status?: string; passed?: number; total?: number }>(
    "artifacts/productization/first-real-tester-launch-verification.json"
  );
  const returnWorkbench = readJson<{
    status?: string;
    operatorRule?: { finalGateCommand?: string; verifyManualSendReceiptBeforeReturnIntake?: boolean };
    sendReceiptHandoff?: {
      requiredBeforeReturnIntake?: boolean;
      sendBundleFingerprintGate?: string;
      submittedSendReceiptValidation?: string;
      validationCommand?: string;
      validationEvidencePath?: string;
    };
  }>("artifacts/productization/first-real-tester-return-workbench.json");
  const returnWorkbenchVerification = readJson<{ status?: string; passed?: number; total?: number }>(
    "artifacts/productization/first-real-tester-return-workbench-verification.json"
  );
  const publicBetaReturnIntake = readJson<{ status?: string; followUpPlan?: { canInviteNextTester?: boolean; status?: string }; copiedReceiptPath?: string | null }>(
    "artifacts/productization/public-beta-return-intake.json"
  );
  const publicBetaReturnVerification = readJson<{ status?: string; passed?: number; total?: number }>(
    "artifacts/productization/public-beta-return-intake-verification.json"
  );
  const publicBetaFollowUpPlan = readJson<{ status?: string; canInviteNextTester?: boolean; counts?: { totalReceipts?: number; validReceipts?: number } }>(
    "artifacts/productization/public-beta-follow-up-plan.json"
  );
  const humanAcceptanceReturnIntake = readJson<{ status?: string; copiedReceiptPath?: string | null; gate?: { status?: string } }>(
    "artifacts/productization/human-acceptance-return-intake.json"
  );
  const humanAcceptanceReturnVerification = readJson<{ status?: string; passed?: number; total?: number }>(
    "artifacts/productization/human-acceptance-return-intake-verification.json"
  );
  const humanAcceptanceGate = readJson<{ status?: string; humanReviewed?: boolean; evidenceKind?: string }>(
    "artifacts/productization/human-acceptance-gate.json"
  );

  const publicBetaReturned = exists("artifacts/productization/public-beta-return-intake.json");
  const humanAcceptanceReturned = exists("artifacts/productization/human-acceptance-return-intake.json");
  const anyFirstReturnProcessed =
    (publicBetaReturned && publicBetaReturnIntake?.status === "processed") ||
    (humanAcceptanceReturned && humanAcceptanceReturnIntake?.status === "recorded_needs_gate_verification");
  const publicBetaAllowsNext =
    publicBetaReturned &&
    publicBetaReturnIntake?.status === "processed" &&
    publicBetaReturnIntake.followUpPlan?.canInviteNextTester === true &&
    publicBetaFollowUpPlan?.canInviteNextTester === true;
  const humanReturnRecorded =
    humanAcceptanceReturned && humanAcceptanceReturnIntake?.status === "recorded_needs_gate_verification";
  const canInviteAdditionalTesterOrReviewer = Boolean(anyFirstReturnProcessed && (publicBetaAllowsNext || humanReturnRecorded));
  const status = canInviteAdditionalTesterOrReviewer
    ? "first_return_processed_ready_for_one_follow_up"
    : anyFirstReturnProcessed
      ? "first_return_processed_needs_follow_up_review"
      : "waiting_for_first_return";

  const gate = {
    responseMode: "first_real_tester_return_gate_json_v1",
    status,
    generatedAt: new Date().toISOString(),
    command: "npm run build:first-real-tester-return-gate",
    productScope: "bounded_core_teaching_loop",
    allSoftwareObjective: "paused",
    releaseDecision: "do_not_release",
    reviewOnly: true,
    accepted: false,
    packagingGated: true,
    canRelease: false,
    canActivateRealModel: false,
    launchReadiness: {
      status: launch?.status ?? "missing",
      readyToLaunch: launch?.readyToLaunch === true,
      verification: statusLine(launchVerification?.status, launchVerification?.passed, launchVerification?.total)
    },
    returnState: {
      anyFirstReturnProcessed,
      canInviteAdditionalTesterOrReviewer,
      requiredBeforeAnyAdditionalInvite: [
        "Run the selected lane return commands from first-real-tester-launch.md.",
        "Use first-real-tester-return-workbench.md to choose exactly one returned lane and bind the required receipts.",
        "Before lane intake, validate the filled first-real-tester send receipt if a manual send occurred.",
        "Archive the returned receipt through the lane intake command.",
        "Run this return gate after intake and inspect canInviteAdditionalTesterOrReviewer.",
        "Keep releaseDecision=do_not_release, accepted=false, packagingGated=true, canRelease=false, and canActivateRealModel=false."
      ]
    },
    returnWorkbench: {
      status: returnWorkbench?.status ?? "missing",
      verification: statusLine(returnWorkbenchVerification?.status, returnWorkbenchVerification?.passed, returnWorkbenchVerification?.total),
      finalGateCommand: returnWorkbench?.operatorRule?.finalGateCommand ?? "missing",
      verifyManualSendReceiptBeforeReturnIntake:
        returnWorkbench?.operatorRule?.verifyManualSendReceiptBeforeReturnIntake === true,
      sendReceiptHandoff: {
        requiredBeforeReturnIntake: returnWorkbench?.sendReceiptHandoff?.requiredBeforeReturnIntake === true,
        sendBundleFingerprintGate: returnWorkbench?.sendReceiptHandoff?.sendBundleFingerprintGate ?? "missing",
        submittedSendReceiptValidation: returnWorkbench?.sendReceiptHandoff?.submittedSendReceiptValidation ?? "missing",
        validationCommand: returnWorkbench?.sendReceiptHandoff?.validationCommand ?? "missing",
        validationEvidencePath: returnWorkbench?.sendReceiptHandoff?.validationEvidencePath ?? "missing"
      },
      evidencePath: "artifacts/productization/first-real-tester-return-workbench.md"
    },
    laneStates: [
      {
        id: "public_beta_tester_session",
        returnIntakePath: "artifacts/productization/public-beta-return-intake.json",
        returnIntakeExists: publicBetaReturned,
        returnStatus: publicBetaReturnIntake?.status ?? "not_returned",
        verification: statusLine(publicBetaReturnVerification?.status, publicBetaReturnVerification?.passed, publicBetaReturnVerification?.total),
        followUpPlanStatus: publicBetaFollowUpPlan?.status ?? "missing",
        canInviteNextTester: publicBetaAllowsNext,
        nextRequiredCommand: publicBetaReturned
          ? "npm run verify:public-beta-follow-up-plan"
          : "npm run intake:public-beta-return -- --receipt <feedback-path> --session-receipt <session-receipt-path> --send-receipt-validation artifacts/productization/first-real-tester-send-receipt-validation.json",
        stopCondition: publicBetaAllowsNext
          ? "A single follow-up tester may be planned, but release remains locked."
          : "Do not invite another tester until a real beta return is intaked and the follow-up plan explicitly allows it."
      },
      {
        id: "human_acceptance_review",
        returnIntakePath: "artifacts/productization/human-acceptance-return-intake.json",
        returnIntakeExists: humanAcceptanceReturned,
        returnStatus: humanAcceptanceReturnIntake?.status ?? "not_returned",
        verification: statusLine(humanAcceptanceReturnVerification?.status, humanAcceptanceReturnVerification?.passed, humanAcceptanceReturnVerification?.total),
        gateStatus: humanAcceptanceGate?.status ?? "missing",
        humanReviewed: humanAcceptanceGate?.humanReviewed === true,
        evidenceKind: humanAcceptanceGate?.evidenceKind ?? "missing",
        nextRequiredCommand: humanAcceptanceReturned
          ? "npm run verify:human-acceptance-return-intake"
          : "npm run intake:human-acceptance-return -- --receipt <path> --send-receipt-validation artifacts/productization/first-real-tester-send-receipt-validation.json",
        stopCondition: humanReturnRecorded
          ? "Process the intake receipt's postIntakeRefresh.commandSequence before relying on refreshed acceptance evidence."
          : "Do not treat human acceptance as returned until a real reviewer receipt is intaked."
      }
    ],
    blockedActions: [
      "release_product",
      "unlock_packaging",
      "activate_real_model",
      "resume_all_software_scope",
      "invite_additional_tester_or_reviewer_before_return_gate_allows_it"
    ],
    nextAction: canInviteAdditionalTesterOrReviewer
      ? "Review the processed first-return evidence, then plan at most one follow-up pass while release stays locked."
      : "Wait for exactly one real tester or reviewer return, process it through the lane intake command, then rebuild and verify this return gate before inviting anyone else."
  };

  const markdown = `# First Real Tester Return Gate\n\nStatus: \`${gate.status}\`\n\nCan invite additional tester or reviewer: \`${gate.returnState.canInviteAdditionalTesterOrReviewer}\`\n\nRelease decision: \`${gate.releaseDecision}\`\n\n## Launch Readiness\n\n| Field | Value |\n| --- | --- |\n| Launch status | \`${gate.launchReadiness.status}\` |\n| Ready to launch | \`${gate.launchReadiness.readyToLaunch}\` |\n| Launch verification | \`${gate.launchReadiness.verification}\` |\n\n## Return Workbench

| Field | Value |
| --- | --- |
| Status | \`${gate.returnWorkbench.status}\` |
| Verification | \`${gate.returnWorkbench.verification}\` |
| Evidence | \`${gate.returnWorkbench.evidencePath}\` |
| Final gate command | \`${gate.returnWorkbench.finalGateCommand}\` |
| Verify manual send receipt before return intake | \`${gate.returnWorkbench.verifyManualSendReceiptBeforeReturnIntake}\` |
| Send bundle fingerprint gate | \`${gate.returnWorkbench.sendReceiptHandoff.sendBundleFingerprintGate}\` |
| Submitted send receipt validation | \`${gate.returnWorkbench.sendReceiptHandoff.submittedSendReceiptValidation}\` |
| Send receipt validation command | \`${gate.returnWorkbench.sendReceiptHandoff.validationCommand}\` |
| Send receipt validation evidence | \`${gate.returnWorkbench.sendReceiptHandoff.validationEvidencePath}\` |

## Required Before Any Additional Invite\n\n${markdownList(gate.returnState.requiredBeforeAnyAdditionalInvite)}\n\n## Lane States\n\n${gate.laneStates
    .map(
      (lane) =>
        `### ${lane.id}\n\n| Field | Value |\n| --- | --- |\n| Return intake exists | \`${lane.returnIntakeExists}\` |\n| Return status | \`${lane.returnStatus}\` |\n| Verification | \`${lane.verification}\` |\n| Next required command | \`${lane.nextRequiredCommand}\` |\n| Stop condition | ${lane.stopCondition} |`
    )
    .join("\n\n")}\n\n## Blocked Actions\n\n${markdownList(gate.blockedActions.map((item) => `\`${item}\``))}\n\n## Boundary\n\n- Product scope: \`${gate.productScope}\`\n- All-software objective: \`${gate.allSoftwareObjective}\`\n- Accepted: \`${gate.accepted}\`\n- Packaging gated: \`${gate.packagingGated}\`\n- Can release: \`${gate.canRelease}\`\n- Can activate real model: \`${gate.canActivateRealModel}\`\n\n## Next Action\n\n${gate.nextAction}\n`;

  fs.mkdirSync(artifactsDir, { recursive: true });
  fs.writeFileSync(gateJsonPath, `${JSON.stringify(gate, null, 2)}\n`, "utf8");
  fs.writeFileSync(gateMarkdownPath, markdown, "utf8");
  return gate;
}

function main() {
  const gate = buildFirstRealTesterReturnGate();
  console.log(JSON.stringify(gate, null, 2));
  console.log(`\nFirst real tester return gate written to ${gateJsonPath}`);
  console.log(`First real tester return gate Markdown written to ${gateMarkdownPath}`);
}

try {
  main();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}

export {};
